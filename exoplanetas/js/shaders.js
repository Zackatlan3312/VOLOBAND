/* Shaders GLSL ES 3.0. Todo es procedural y analitico: no hay texturas
   rasterizadas, por eso la imagen se mantiene nitida a cualquier resolucion. */
(function () {
  'use strict';
  const EXO = (window.EXO = window.EXO || {});

  const HEAD = '#version 300 es\nprecision highp float;\n';

  /* Simplex noise 3D (Ashima Arts / Stefan Gustavson, licencia MIT) */
  const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*0.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec3 tonemap(vec3 x){return 1.0-exp(-max(x,0.0)*1.1);}
vec3 toSRGB(vec3 x){return pow(tonemap(x),vec3(1.0/2.2));}
`;

  /* Triangulo que cubre toda la pantalla, sin atributos */
  const VS_FULL = HEAD + `
void main(){
  vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
  gl_Position=vec4(p*2.0-1.0,0.0,1.0);
}`;

  /* ---------- Nebulosa y via lactea (se renderiza a media resolucion) ---------- */
  const FS_NEBULA = HEAD + NOISE + `
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uOff;
uniform vec3 uTintA;
uniform vec3 uTintB;
out vec4 o;
float fbm(vec3 p){float a=0.5,s=0.0;for(int i=0;i<5;i++){s+=a*snoise(p);p=p*2.02+vec3(3.1,7.7,1.3);a*=0.5;}return s;}
void main(){
  vec2 p=(gl_FragCoord.xy-0.5*uRes)/uRes.y+uOff;
  vec2 dir=normalize(vec2(1.0,0.38));
  float d=dot(p-vec2(0.0,0.08),vec2(-dir.y,dir.x));
  float band=exp(-d*d*6.5);
  float t=uTime*0.004;
  vec3 q=vec3(p*1.5,t);
  float n1=fbm(q);
  float n2=fbm(q*1.8+vec3(n1*1.4,-n1,4.0));
  float dust=smoothstep(0.0,0.45,fbm(q*3.4+vec3(9.0,2.0,n2*0.8)));
  vec3 col=vec3(0.0016,0.0019,0.0048);
  float neb=smoothstep(-0.25,0.85,n2);
  col+=uTintA*neb*(0.0055+band*0.07);
  col+=uTintB*pow(max(n1+0.1,0.0),2.0)*(0.008+band*0.065);
  col+=vec3(0.55,0.5,0.62)*band*(0.012+0.012*n2);
  col*=1.0-dust*band*0.75;
  o=vec4(pow(col,vec3(1.0/2.2)),1.0);
}`;

  /* ---------- Composicion: nebulosa + estrella del hero + vineta ---------- */
  const FS_COMPOSITE = HEAD + NOISE + `
uniform sampler2D uNeb;
uniform vec2 uRes;
uniform vec4 uSun;
uniform vec3 uSunCol;
uniform float uTime;
uniform float uDim;
uniform int uMode;
out vec4 o;
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec3 col=vec3(0.0);
  if(uMode==0){ col=pow(texture(uNeb,uv).rgb,vec3(2.2))*(1.0-uDim*0.6); }
  if(uSun.w>0.001){
    vec2 d=gl_FragCoord.xy-uSun.xy;
    float r=length(d)/uSun.z;
    float ang=atan(d.y,d.x);
    if(uMode==0){
      float core=1.0-smoothstep(0.96,1.04,r);
      float glow=exp(-r*0.55)*0.9+1.0/(1.0+r*r*0.35)*0.5;
      float rays=(0.55+0.45*sin(ang*11.0+uTime*0.05))*(0.6+0.4*sin(ang*17.0-uTime*0.04));
      rays*=exp(-r*0.16)*0.22;
      col+=uSunCol*(core*14.0+glow+rays)*uSun.w;
    } else {
      float bloom=exp(-r*0.45)*0.35;
      float streak=exp(-abs(d.y)/(uSun.z*0.07))*exp(-abs(d.x)/(uRes.x*0.2))*0.3;
      float ring=exp(-pow((r-7.5)*0.9,2.0))*0.025;
      col+=uSunCol*(bloom+streak+ring)*uSun.w;
    }
  }
  if(uMode==0){
    vec2 v=uv-0.5; v.x*=uRes.x/uRes.y;
    col*=1.0-smoothstep(0.35,1.25,length(v))*0.6;
    col=toSRGB(col)+(hash12(gl_FragCoord.xy)-0.5)/255.0;
    o=vec4(col,1.0);
  } else {
    o=vec4(pow(col,vec3(1.0/2.2)),0.0);
  }
}`;

  /* ---------- Estrellas (quads instanciados, se estiran con la velocidad de scroll) ---------- */
  const VS_STARS = HEAD + `
layout(location=0) in vec2 aPos;
layout(location=1) in vec4 aData;
layout(location=2) in vec3 aCol;
uniform vec2 uRes;
uniform vec2 uOff;
uniform float uTime;
uniform float uScale;
uniform float uStreak;
out vec2 vP;
out vec3 vCol;
out float vA;
out float vSize;
out float vStretch;
out float vSpike;
void main(){
  vec2 corner=vec2((gl_VertexID&1)==0?-1.0:1.0,(gl_VertexID&2)==0?-1.0:1.0);
  float depth=aData.x;
  vec2 pos=fract(aPos+uOff*depth)*1.1-0.05;
  vec2 px=pos*uRes;
  float size=max(aData.y*uScale,0.75);
  float spike=aData.w>0.965?1.0:0.0;
  float stretch=abs(uStreak)*depth*uScale*0.9;
  float ext=size*(spike>0.5?10.0:3.2);
  vec2 hs=vec2(ext,ext+stretch);
  vP=corner*hs;
  vSize=size; vStretch=stretch; vSpike=spike;
  float tw=0.72+0.28*sin(uTime*(0.5+aData.z*2.2)+aData.z*61.0);
  vA=aData.w*tw*min(aData.y*uScale/0.75,1.0)*(size/(size+stretch*0.6));
  vCol=aCol;
  gl_Position=vec4((px+corner*hs)/uRes*2.0-1.0,0.0,1.0);
}`;
  const FS_STARS = HEAD + `
in vec2 vP; in vec3 vCol; in float vA; in float vSize; in float vStretch; in float vSpike;
uniform float uDim;
out vec4 o;
void main(){
  vec2 d=vec2(vP.x,max(abs(vP.y)-vStretch,0.0));
  float r=length(d)/vSize;
  float I=exp(-r*r*1.6)+exp(-r*1.6)*0.07;
  if(vSpike>0.5){
    float sx=exp(-abs(vP.y)/(vSize*0.28))*exp(-abs(vP.x)/(vSize*3.2));
    float sy=exp(-abs(vP.x)/(vSize*0.28))*exp(-abs(vP.y)/(vSize*3.2));
    I+=(sx+sy)*0.45;
  }
  vec3 c=vCol*I*vA*(1.0-uDim*0.55);
  o=vec4(c,0.0);
}`;

  /* ---------- Planeta: esfera analitica. Continentes procedurales cubiertos con
     terreno real (NASA Blue Marble) y nubes reales de la Tierra (NASA) ---------- */
  const FS_PLANET = HEAD + 'precision highp sampler2DArray;\n' + NOISE + `
uniform vec3 uView;
uniform float uR;
uniform mat3 uRot;
uniform float uCloudSpin;
uniform vec3 uL;
uniform vec3 uSub;
uniform vec3 uStar;
uniform float uSeed;
uniform float uFreq;
uniform float uSea;
uniform float uIce;
uniform float uEye;
uniform float uCloud;
uniform float uBands;
uniform float uAtmoK;
uniform float uHaze;
uniform float uRelief;
uniform float uOct;
uniform float uFade;
uniform float uExpo;
uniform float uTime;
uniform vec2 uVFade;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uLow;
uniform vec3 uHigh;
uniform vec3 uSnow;
uniform vec3 uAtmo;
uniform sampler2D uCloudTex;
uniform sampler2DArray uLandTex;
uniform sampler2D uEarthTex;
uniform sampler2D uOceanTex;
uniform float uTexOn;
uniform float uEarth;
uniform float uCloudLon;
uniform float uClimate;
uniform float uWet;
uniform float uSat;
uniform vec3 uVeg;
uniform float uLandScale;
uniform vec3 uTint;
out vec4 o;

float fbm(vec3 p,float oct){
  float a=0.5,s=0.0,n=0.0;
  for(int i=0;i<10;i++){
    float fi=float(i);
    if(fi>=oct) break;
    float w=clamp(oct-fi,0.0,1.0);
    s+=a*w*snoise(p); n+=a*w;
    p=p*2.03+vec3(1.7,-9.2,5.3);
    a*=0.5;
  }
  return s/max(n,1e-4);
}
vec3 rotY(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(c*v.x+s*v.z,v.y,-s*v.x+c*v.z);}
vec2 lonlat(vec3 d){return vec2(atan(d.x,d.z)*0.15915494+0.5,0.5-asin(clamp(d.y,-1.0,1.0))*0.31830989);}

/* muestreo triplanar de una capa del atlas de terreno real */
vec3 tri(float layer,vec3 tp,vec3 tw,vec3 gx,vec3 gy){
  vec3 c=vec3(0.0);float s=0.0;
  if(tw.x>0.03){c+=tw.x*textureGrad(uLandTex,vec3(tp.zy,layer),gx.zy,gy.zy).rgb;s+=tw.x;}
  if(tw.y>0.03){c+=tw.y*textureGrad(uLandTex,vec3(tp.xz,layer),gx.xz,gy.xz).rgb;s+=tw.y;}
  if(tw.z>0.03){c+=tw.z*textureGrad(uLandTex,vec3(tp.xy,layer),gx.xy,gy.xy).rgb;s+=tw.z;}
  return c/max(s,1e-4);
}
float gw(float T,float M,float t0,float m0,float st,float sm){return exp(-(((T-t0)*(T-t0))/(st*st)+((M-m0)*(M-m0))/(sm*sm)));}

/* terreno real: los dos biomas mas probables segun temperatura y humedad, y montanas */
vec3 realLand(vec3 q,float e,float lat,float moist,vec3 dqx,vec3 dqy){
  vec3 tp=q*uLandScale+vec3(uSeed*0.37,uSeed*0.11,-uSeed*0.23);
  vec3 tw=pow(abs(q),vec3(8.0));tw/=(tw.x+tw.y+tw.z);
  vec3 gx=dqx*uLandScale,gy=dqy*uLandScale;
  float T=uClimate+0.45-lat*1.35-e*0.5;
  float M=(moist*2.0-1.0)*0.85+uWet;
  float w[6];
  w[0]=gw(T,M,0.85,-0.95,0.5,0.55);
  w[1]=gw(T,M,0.25,-0.55,0.45,0.45);
  w[2]=gw(T,M,0.75,0.0,0.4,0.4);
  w[3]=gw(T,M,0.9,0.85,0.45,0.45);
  w[4]=gw(T,M,0.05,0.45,0.4,0.5);
  w[5]=gw(T,M,-0.55,0.3,0.45,0.6);
  /* los dos biomas mas fuertes, restando el tercero para que las transiciones sean continuas */
  int i1=0;
  for(int i=1;i<6;i++){if(w[i]>w[i1])i1=i;}
  int i2=i1==0?1:0;
  for(int i=0;i<6;i++){if(i!=i1&&w[i]>w[i2])i2=i;}
  float w3=0.0;
  for(int i=0;i<6;i++){if(i!=i1&&i!=i2)w3=max(w3,w[i]);}
  float a1=w[i1]-w3+1e-5,a2=max(w[i2]-w3,0.0);
  vec3 c=tri(float(i1),tp,tw,gx,gy)*a1;float s=a1;
  if(a2>a1*0.02){c+=tri(float(i2),tp,tw,gx,gy)*a2;s+=a2;}
  c/=s;
  float mtn=smoothstep(0.34,0.66,e);
  if(mtn>0.01){
    float lay=moist>0.5?7.0:6.0;
    c=mix(c,tri(lay,tp*1.4+3.0,tw,gx*1.4,gy*1.4),mtn);
  }
  float vk=step(0.02,abs(uVeg.r-1.0)+abs(uVeg.g-1.0)+abs(uVeg.b-1.0));
  float g=clamp((c.g-max(c.r,c.b))*14.0,0.0,1.0)*vk;
  c=mix(c,vec3(dot(c,vec3(0.3,0.55,0.15)))*uVeg*1.5,g);
  return mix(vec3(dot(c,vec3(0.2126,0.7152,0.0722))),c,uSat);
}

void main(){
  vec2 p=(gl_FragCoord.xy-uView.xy)/uView.z;
  float r=length(p);
  float px=1.0/uView.z;
  vec3 L=normalize(uL);
  vec3 atmoC=uAtmo*uStar;

  /* halo atmosferico fuera del disco */
  float hT=uR*0.085;
  float hx=max(r-uR,0.0)/hT;
  vec2 pd=p/max(r,1e-5);
  float lf=dot(pd,L.xy);
  float lit=smoothstep(-0.55,0.75,lf+L.z*0.55);
  float back=pow(max(dot(pd,normalize(L.xy+1e-5)),0.0),5.0)*max(-L.z,0.0)*2.2;
  float halo=exp(-hx*2.3)*(lit*0.8+back+0.02)*uAtmoK;
  float hE1=min(uR+hT*4.0,1.0);
  halo*=1.0-smoothstep(min(uR+hT*2.5,hE1-0.002),hE1,r);
  vec3 haloCol=atmoC*halo*0.55;

  vec3 col=vec3(0.0);
  float cover=0.0;
  if(r<uR+px*1.5){
    float rr=min(r,uR);
    vec3 n=normalize(vec3(p,sqrt(max(uR*uR-rr*rr,0.0))));
    vec3 q=uRot*n;
    /* derivadas en flujo uniforme: nivel de detalle por pixel y gradientes de textura */
    vec3 dqx=dFdx(q),dqy=dFdy(q);
    float fp=max(length(dqx),length(dqy));
    float octP=clamp(log2(1.0/(fp*uFreq*2.2+1e-6))+1.0,2.0,uOct);
    vec3 cq=rotY(q,uCloudSpin+uCloudLon);
    vec2 cuv=lonlat(cq);
    vec2 cdx=dFdx(cuv),cdy=dFdy(cuv);
    cdx.x-=floor(cdx.x+0.5);cdy.x-=floor(cdy.x+0.5);
    vec2 euv=lonlat(q);
    vec2 edx=dFdx(euv),edy=dFdy(euv);
    edx.x-=floor(edx.x+0.5);edy.x-=floor(edy.x+0.5);
    bool realEarth=uEarth*uTexOn>0.5;
    float ndlS=dot(n,L);
    vec3 c=vec3(0.0);
    if(ndlS>-0.38){
    vec3 sp=q*uFreq+uSeed;
    float lat=abs(q.y);
    float dsub=dot(q,normalize(uSub));
    vec3 surf;float ocean;float ice=0.0;float relief=0.0;float h=0.0;float det=0.0;
    vec3 w=vec3(0.0);
    if(realEarth){
      /* la Tierra real: imagen satelital y mascara de oceano de la NASA */
      surf=textureGrad(uEarthTex,euv,edx,edy).rgb;
      ocean=textureGrad(uOceanTex,euv,edx,edy).r;
    } else {
      w=vec3(snoise(sp*0.55+3.1),snoise(sp*0.55+17.7),snoise(sp*0.55+41.3));
      h=fbm(sp+w*0.62,octP);
      det=octP>5.0?snoise(sp*7.0+11.0):0.0;

      float land=h-uSea;
      float fw=fwidth(land)*0.8+1e-5;
      float isLand=smoothstep(-fw,fw,land);
      float e=clamp((h-max(uSea,-0.22))/0.42,0.0,1.0);
      float moist=snoise(sp*0.7+vec3(70.0))*0.5+0.5;
      vec3 lowC=mix(uLow*vec3(1.35,1.12,0.78)+vec3(0.02,0.015,0.0),uLow,smoothstep(0.3,0.7,moist-lat*0.25));
      vec3 landC=mix(lowC,uHigh,smoothstep(0.1,0.62,e));
      landC=mix(landC,uHigh*0.62+vec3(0.05),smoothstep(0.55,0.88,e));
      landC*=0.86+0.24*(det*0.5+0.5);
      if(uTexOn>0.001&&uSea<0.95&&land>-0.04){
        vec3 rl=realLand(q,e,lat,moist,dqx,dqy)*uTint;
        if(octP>6.5) rl*=0.94+0.12*(snoise(sp*26.0+5.0)*0.5+0.5);
        landC=mix(landC,rl,uTexOn);
      }
      float snowLine=0.9-lat*0.62;
      landC=mix(landC,uSnow,smoothstep(snowLine-0.05,snowLine+0.05,e));
      vec3 seaC=mix(uDeep,uShallow,smoothstep(-0.08,0.0,land)*0.85);
      seaC*=0.92+0.08*det;
      surf=mix(seaC,landC,isLand);
      ocean=1.0-isLand;

      /* hielo polar y planetas "ojo" (rotacion sincronizada) */
      float iceN=w.z*0.05+det*0.014;
      ice=smoothstep(1.0-uIce-0.025,1.0-uIce+0.025,lat+iceN);
      if(uEye>-1.5){
        float eyeIce=1.0-smoothstep(uEye-0.06,uEye+0.06,dsub+iceN*1.4);
        ice=max(ice,eyeIce);
      }
      vec3 iceC=mix(uSnow,uSnow*vec3(0.74,0.86,0.98),clamp(det*0.35+0.3+smoothstep(0.0,-0.2,land)*0.35,0.0,1.0));
      surf=mix(surf,iceC,ice);
      ocean*=1.0-ice;

      /* bandas: mundos hiceanicos y gigantes */
      if(uBands>0.0){
        float bl=q.y*6.5+w.x*0.9+snoise(vec3(q.xz*2.2,q.y*13.0)+uSeed)*0.4;
        float b1=sin(bl*1.8)*0.5+0.5;
        float b2=snoise(vec3(q.x*3.0,q.y*22.0+w.y*2.0,q.z*3.0)+uSeed*3.0)*0.5+0.5;
        vec3 bc=mix(uDeep,uShallow,b1);
        bc=mix(bc,uLow,smoothstep(0.5,0.9,b2)*0.55);
        bc=mix(bc,uHigh,smoothstep(0.35,0.7,h)*0.35);
        surf=mix(surf,bc,uBands);
        ocean*=1.0-uBands;
      }

      /* relieve: segunda muestra del terreno desplazada hacia la luz */
      if(uRelief>0.0&&land>-0.03&&ice<0.95&&uBands<0.5){
        vec3 Lp=uRot*L;
        vec3 Lt=Lp-q*dot(Lp,q);
        float lt=length(Lt);
        if(lt>1e-4){
          float eps=max(fp*1.6,0.0016);
          vec3 q2=normalize(q+Lt/lt*eps);
          float h2=fbm(q2*uFreq+uSeed+w*0.62,octP);
          relief=clamp((h-h2)/eps*uRelief*0.024,-0.7,0.7)*smoothstep(-0.03,0.02,land)*(1.0-ice*0.7);
        }
      }
    }

    /* nubes: mapa real de nubes de la Tierra (NASA), con detalle extra al ampliar */
    float cloud=0.0;
    if(uCloud>0.001){
      float cProc=0.0;
      if(uTexOn<0.999){
        vec3 cp=cq*uFreq*1.2+uSeed*1.37+50.0;
        vec3 cw=vec3(snoise(cp*0.6),snoise(cp*0.6+9.0),0.0);
        float cn=fbm(vec3(cp.x,cp.y*1.45,cp.z)+cw*0.42+vec3(0.0,0.0,uTime*0.004),clamp(octP-1.0,2.0,uOct-1.0));
        float cl=abs(cq.y);
        float band=0.82+0.22*cos(cl*9.4)+0.12*smoothstep(0.55,0.8,cl);
        float thr=mix(0.42,-0.3,uCloud)/band;
        cProc=smoothstep(thr-0.02,thr+0.36,cn*band);
        cProc*=cProc*(3.0-2.0*cProc);
      }
      float cTex=0.0;
      if(uTexOn>0.001){
        float t=textureGrad(uCloudTex,cuv,cdx,cdy).r;
        if(octP>6.0){
          float dn=fbm(cq*uFreq*10.0+vec3(uSeed*2.0),min(octP-5.0,3.0));
          t+=dn*0.2*smoothstep(0.02,0.3,t)*(1.0-smoothstep(0.7,1.0,t));
        }
        if(realEarth) cTex=smoothstep(0.05,0.85,t);
        else {float lo=mix(0.62,0.0,clamp(uCloud,0.0,1.0));cTex=smoothstep(lo,lo+0.5,t);}
      }
      cloud=mix(cProc,cTex,uTexOn);
      if(uEye>-1.5){cloud*=0.25+0.95*smoothstep(uEye-0.35,uEye+0.45,dsub);}
    }

    /* iluminacion */
    float diffuse=max(ndlS,0.0);
    float wrapD=smoothstep(-0.16,0.5,ndlS);
    float light=mix(diffuse,wrapD*0.92,0.3*clamp(uAtmoK,0.0,1.0))*(1.0+relief);
    c=surf*(1.0-cloud*0.3)*light*uStar;

    vec3 H=normalize(L+vec3(0.0,0.0,1.0));
    float nh=max(dot(n,H),0.0);
    float fres=0.02+0.98*pow(1.0-max(n.z,0.0),5.0);
    float spec=(pow(nh,220.0)*1.7+pow(nh,30.0)*0.07)*ocean*(1.0-cloud)*step(0.0,ndlS);
    c+=uStar*spec;
    c+=atmoC*fres*ocean*wrapD*0.22*uAtmoK;

    float cLight=smoothstep(-0.1,0.65,ndlS);
    vec3 cloudC=mix(vec3(0.96,0.97,1.0),uHigh,uBands*0.4);
    c=mix(c,cloudC*uStar*cLight,cloud*0.93);

    float tw=exp(-pow((ndlS+0.03)*6.0,2.0));
    c+=vec3(1.0,0.4,0.16)*uStar*tw*0.09*uAtmoK*(0.4+cloud);
    }

    /* atmosfera: siempre, tambien en el lado nocturno */
    float mu=max(n.z,0.0);
    float rim=pow(1.0-mu,2.3);
    float aLit=smoothstep(-0.32,0.55,ndlS);
    c=mix(c,atmoC*aLit*0.95,clamp(uHaze*(0.35+0.65*rim),0.0,1.0));
    c+=atmoC*rim*aLit*uAtmoK*0.85;
    c+=atmoC*pow(1.0-mu,7.0)*max(-L.z,0.0)*uAtmoK*1.6*smoothstep(-0.2,0.8,dot(normalize(p),normalize(L.xy+1e-5)));
    c+=uAtmo*0.0025*(1.0-aLit)*uAtmoK;

    col=c;
    cover=1.0-smoothstep(uR-px*0.9,uR+px*0.6,r);
  }

  vec3 planetS=toSRGB(col*uExpo);
  vec3 haloS=pow(tonemap(haloCol*uExpo),vec3(1.0/2.2));
  vec3 outC=planetS*cover+haloS*(1.0-cover);
  float outA=cover+clamp(halo*0.22,0.0,0.6)*(1.0-cover);
  outC+=(hash12(gl_FragCoord.xy)-0.5)/255.0*step(0.002,outA);
  float vf=uVFade.y>uVFade.x?smoothstep(uVFade.x,uVFade.y,gl_FragCoord.y):1.0;
  o=vec4(outC*uFade*vf,outA*uFade*vf);
}`;

  /* ---------- La Tierra real girando: 12 fotos EPIC (NASA/DSCOVR) proyectadas
     sobre una esfera e interpoladas entre si ---------- */
  const FS_EPIC = HEAD + 'precision highp sampler2DArray;\n' + `
uniform vec3 uView;
uniform float uR;
uniform sampler2DArray uEpic;
uniform vec2 uCur;
uniform vec4 uA;
uniform vec4 uB;
uniform vec4 uGeo;
uniform float uF;
uniform float uFade;
out vec4 o;
vec3 rX(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(v.x,c*v.y-s*v.z,s*v.y+c*v.z);}
vec3 rY(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(c*v.x+s*v.z,v.y,-s*v.x+c*v.z);}
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*0.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
void main(){
  vec2 p=(gl_FragCoord.xy-uView.xy)/uView.z;
  float r=length(p);
  float px=1.0/uView.z;
  float hx=max(r-uR,0.0)/(uR*0.045);
  float halo=exp(-hx*2.0)*(1.0-smoothstep(uR*1.12,uR*1.25,r));
  vec3 col=vec3(0.0);
  float cover=0.0;
  if(r<uR+px*1.5){
    float rr=min(r,uR);
    vec3 n=normalize(vec3(p,sqrt(max(uR*uR-rr*rr,0.0))));
    vec3 w=rY(rX(n,-uCur.x),uCur.y);
    vec3 va=rX(rY(w,-uA.y),uA.x);
    vec3 vb=rX(rY(w,-uB.y),uB.x);
    vec2 ua=vec2(uGeo.x+va.x*uA.w,uGeo.y-va.y*uA.w);
    vec2 ub=vec2(uGeo.z+vb.x*uB.w,uGeo.w-vb.y*uB.w);
    vec3 ca=texture(uEpic,vec3(ua,uA.z)).rgb;
    vec3 cb=texture(uEpic,vec3(ub,uB.z)).rgb;
    float wa=(1.0-uF)*smoothstep(0.0,0.3,va.z)+1e-4;
    float wb=uF*smoothstep(0.0,0.3,vb.z)+1e-4;
    col=(ca*wa+cb*wb)/(wa+wb);
    cover=1.0-smoothstep(uR-px*0.9,uR+px*0.6,r);
  }
  vec3 haloC=vec3(0.32,0.52,1.0)*halo*0.28;
  vec3 outC=col*cover+haloC*(1.0-cover);
  outC+=(hash12(gl_FragCoord.xy)-0.5)/255.0*cover;
  float a=cover+halo*0.08*(1.0-cover);
  o=vec4(outC*uFade,a*uFade);
}`;

  /* ---------- Estrella con granulacion (sistema TRAPPIST-1) ---------- */
  const FS_STAR = HEAD + NOISE + `
uniform vec3 uView;
uniform float uR;
uniform vec3 uCol;
uniform float uTime;
out vec4 o;
void main(){
  vec2 p=(gl_FragCoord.xy-uView.xy)/uView.z;
  float r=length(p);
  float px=1.0/uView.z;
  float cover=1.0-smoothstep(uR-px,uR+px,r);
  vec3 c=vec3(0.0);
  if(r<uR+px){
    float z=sqrt(max(uR*uR-r*r,0.0))/uR;
    vec3 n=normalize(vec3(p/uR,z));
    float limb=0.35+0.65*pow(z,0.5);
    float g=snoise(n*16.0+vec3(0.0,0.0,uTime*0.18))*0.5+0.5;
    float g2=snoise(n*4.5+vec3(uTime*0.03))*0.5+0.5;
    float spots=smoothstep(0.66,0.82,g2);
    c=uCol*limb*(2.4+0.6*g-spots*1.4);
  }
  float rr=r/uR;
  float gw=exp(-(rr-1.0)*1.1)*0.55+0.35/(1.0+rr*rr*0.25);
  gw*=1.0-smoothstep(0.55,1.0,r);
  vec3 glow=uCol*gw*0.55;
  vec3 outC=toSRGB(c)*cover+pow(tonemap(glow),vec3(1.0/2.2))*(1.0-cover);
  o=vec4(outC,cover);
}`;

  /* ---------- Orbitas y zona habitable (sistema TRAPPIST-1) ---------- */
  const FS_ORBITS = HEAD + `
uniform vec3 uView;
uniform float uElev;
uniform float uOrb[7];
uniform float uHi;
uniform vec2 uHZ;
uniform float uHZa;
uniform float uLineW;
out vec4 o;
void main(){
  vec2 p=(gl_FragCoord.xy-uView.xy)/uView.z;
  vec2 q=vec2(p.x,p.y/max(uElev,0.015));
  float r=length(q);
  float fw=max(fwidth(r),1e-5);
  vec3 col=vec3(0.0);
  float hz=smoothstep(uHZ.x-fw,uHZ.x+0.012,r)*(1.0-smoothstep(uHZ.y-0.012,uHZ.y+fw,r));
  float hzEdge=(1.0-smoothstep(0.0,fw*uLineW,abs(r-uHZ.x)))+(1.0-smoothstep(0.0,fw*uLineW,abs(r-uHZ.y)));
  col+=vec3(0.08,0.62,0.48)*hz*0.16*uHZa;
  col+=vec3(0.3,1.0,0.8)*hzEdge*0.12*uHZa;
  for(int i=0;i<7;i++){
    float d=abs(r-uOrb[i]);
    float line=1.0-smoothstep(fw*uLineW*0.5,fw*uLineW*1.5,d);
    float isHi=1.0-step(0.5,abs(float(i)-uHi));
    float inHZ=step(uHZ.x,uOrb[i])*step(uOrb[i],uHZ.y)*uHZa;
    vec3 lc=mix(vec3(0.55,0.62,0.85),vec3(0.4,1.0,0.82),inHZ);
    col+=lc*line*(0.2+isHi*0.7);
  }
  col*=smoothstep(1.02,0.9,length(p));
  o=vec4(col,0.0);
}`;

  EXO.shaders = { VS_FULL, FS_NEBULA, FS_COMPOSITE, VS_STARS, FS_STARS, FS_PLANET, FS_STAR, FS_ORBITS, FS_EPIC };
})();
