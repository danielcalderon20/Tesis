/** Cloudflare Pages, modo avanzado. No subas claves dentro de este archivo.
 *  Guarda OPENAI_API_KEY como secreto cifrado en Cloudflare Pages.
 *  Los archivos estáticos se sirven con env.ASSETS.fetch.
 */
const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const answer=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
const POLICY=`Eres un orientador educativo de un proyecto universitario colombiano llamado «Antes de buscar compañía, aprende a acompañar». Responde únicamente sobre decisiones conscientes de cuidado de perros y gatos en Bogotá. Tu base conceptual proviene de la investigación y documentos del IDPYBA, sin atribuirle datos que no conozcas.
Hallazgo central literal: «La conciencia general sobre la responsabilidad asociada al cuidado animal no siempre se traduce en una evaluación concreta de las condiciones necesarias para sostener esa responsabilidad.»
Insight: «Cuando imagino tener un animal, pienso en todo lo que puede traer a mi vida. Sin embargo, no siempre pienso en todo lo que mi vida tendrá que darle a él.»
El cuidado requiere considerar tiempo, dinero, salud, espacio, personas de apoyo, futuras mudanzas y cambios. Evita afirmar generalizaciones universales: cada animal tiene necesidades individuales.
Tono cercano, cálido, en español de Colombia, claro y breve (120-190 palabras). No inventes cifras, estudios, costos ni contenidos específicos de los documentos. Privilegia la adopción responsable; si alguien decide comprar, recomienda comprobar origen y bienestar y evitar explotación o maltrato. No recomiendes criaderos concretos ni anuncies certificaciones no verificadas. No hagas diagnósticos o tratamientos veterinarios; ante síntomas urgentes, indica acudir a urgencias veterinarias. Termina con dos preguntas concretas para ayudar a la persona a pensar en su realidad. No actúes como representante del IDPYBA.`;
export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if(url.pathname!=="/api/preguntar")return env.ASSETS.fetch(request);
    if(request.method!=="POST")return answer({error:"Método no permitido"},405);
    const origin=request.headers.get('Origin');
    if(origin && origin!==url.origin)return answer({error:"Origen no autorizado"},403);
    if(!env.OPENAI_API_KEY)return answer({error:"Servicio IA pendiente de activación"},503);
    const size=Number(request.headers.get('content-length')||0);
    if(size>6000)return answer({error:"Consulta demasiado larga"},413);
    let body;
    try{body=await request.json();}catch{return answer({error:"Formato JSON incorrecto"},400);}
    const question=typeof body?.question==='string'?body.question.trim():'';
    if(!question || question.length>1200)return answer({error:"Pregunta inválida o demasiado larga"},400);
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12500);
    try{
      const res=await fetch('https://api.openai.com/v1/responses',{
        method:'POST',signal:controller.signal,
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${env.OPENAI_API_KEY}`},
        body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-6-luna',reasoning:{effort:'none'},instructions:POLICY,input:question,max_output_tokens:500,store:false})
      });
      if(!res.ok)return answer({error:'No se pudo generar la respuesta'},502);
      const data=await res.json();
      let text=typeof data.output_text==='string'?data.output_text:'';
      if(!text && Array.isArray(data.output))text=data.output.flatMap(o=>Array.isArray(o.content)?o.content:[]).filter(x=>x.type==='output_text' && typeof x.text==='string').map(x=>x.text).join('\n');
      if(!text.trim())return answer({error:'No se recibió texto de la IA'},502);
      return answer({answer:text.slice(0,2500),source:'ia'});
    }catch{return answer({error:'El asistente no respondió a tiempo'},503);}
    finally{clearTimeout(timeout);}
  }
};
