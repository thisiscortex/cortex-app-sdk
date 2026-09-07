import http from 'node:http';
import { HostError } from './index.mjs';

/** Process-side AG-UI client. Endpoint/token are supplied only by Cortex. */
export function connectAgUi() {
  const endpoint = /^(unix|npipe):(.+)$/.exec(process.env.CORTEX_HOST_ENDPOINT || '');
  const token = process.env.CORTEX_HOST_TOKEN, appId = process.env.CORTEX_APP_ID;
  if (!endpoint || !token || !appId) return null;
  function request(route, payload, options = {}) {
    const encoded = payload === undefined ? null : JSON.stringify(payload);
    if (encoded && Buffer.byteLength(encoded) > 2 * 1024 * 1024) return Promise.reject(new HostError('AG-UI input is too large.','body_too_large',413));
    return new Promise((resolve,reject) => {
      let bytes=0, buffer='', resultText='', events=[], calls=new Map(), selection=null, finished=false, settled=false;
      const done=(error,value)=>{if(settled)return;settled=true;options.signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);};
      const call=http.request({socketPath:endpoint[2],path:route,method:encoded?'POST':'GET',
        headers:{'x-cortex-host-token':token,...(encoded?{'content-type':'application/json','content-length':Buffer.byteLength(encoded)}:{})}},
        response=>{
          response.setEncoding('utf8');
          response.on('data',chunk=>{
            bytes+=Buffer.byteLength(chunk);
            if(bytes>4*1024*1024){call.destroy(new HostError('AG-UI response exceeds its limit.','bad_response',502));return;}
            buffer+=chunk;
            if(response.statusCode!==200||route.endsWith('/provider'))return;
            let boundary;
            while((boundary=buffer.indexOf('\n\n'))>=0){
              const block=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);
              const data=block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
              if(!data)continue;
              let event;try{event=JSON.parse(data);}catch{call.destroy(new HostError('Invalid AG-UI event.','bad_response',502));return;}
              events.push(event);options.onEvent?.(event);
              if(event.type==='CUSTOM'&&event.name==='cortex.provider')selection=event.value;
              if(event.type==='TEXT_MESSAGE_CONTENT')resultText+=event.delta||'';
              if(event.type==='TOOL_CALL_START')calls.set(event.toolCallId,{id:event.toolCallId,name:event.toolCallName,arguments:''});
              if(event.type==='TOOL_CALL_ARGS'){
                const entry=calls.get(event.toolCallId);
                if(!entry){call.destroy(new HostError('Tool arguments preceded their call.','bad_response',502));return;}
                entry.arguments+=event.delta||'';
              }
              if(event.type==='RUN_ERROR'){done(new HostError(event.message,event.code,502));call.destroy();return;}
              if(event.type==='RUN_FINISHED')finished=true;
            }
          });
          response.on('end',()=>{
            if(response.statusCode!==200){
              let body;try{body=JSON.parse(buffer);}catch{}
              return done(new HostError(body?.error||'Cortex refused app inference.',body?.code||'host_error',response.statusCode));
            }
            if(route.endsWith('/provider')){try{return done(null,JSON.parse(buffer));}catch{return done(new HostError('Invalid provider response.','bad_response',502));}}
            if(!finished)return done(new HostError('AG-UI stream ended before completion.','incomplete_stream',502));
            done(null,{text:resultText,toolCalls:[...calls.values()],selection,events});
          });
          response.on('error',error=>done(error));
        });
      const abort=()=>{done(new HostError('AG-UI request cancelled.','cancelled',499));call.destroy();};
      if(options.signal?.aborted)abort();else options.signal?.addEventListener('abort',abort,{once:true});
      call.setTimeout(190000,()=>call.destroy(new HostError('Cortex inference timed out.','timeout',504)));
      call.on('error',error=>done(error));
      call.end(encoded);
    });
  }
  return {
    appId,
    provider:()=>request('/v1/ag-ui/provider'),
    run:(input,options={})=>request('/v1/ag-ui',input,options),
  };
}
