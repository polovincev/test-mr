import React, {createContext, useContext, useState, useEffect} from "react";

interface AuthCtx {token: string | null; login: (t: string)=>void; logout: ()=>void}
const Ctx = createContext<AuthCtx>({token:null, login: ()=>{}, logout: ()=>{}});
export const useAuth = ()=> useContext(Ctx);
export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children})=>{
  const [token,setTok] = useState<string|null>(()=> localStorage.getItem("token"));
  const login = (t:string)=>{localStorage.setItem("token",t); setTok(t);};
  const logout = ()=>{localStorage.removeItem("token"); setTok(null);};
  useEffect(()=>{const h=(e:StorageEvent)=>{if(e.key==="token") setTok(localStorage.getItem("token"));};window.addEventListener("storage",h);return ()=>window.removeEventListener("storage",h);},[]);
  return <Ctx.Provider value={{token,login,logout}}>{children}</Ctx.Provider>;
}
