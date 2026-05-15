import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { safeJsonParse } from "@/utils/safeJson";

export default function CallsAdmin(){
  const { t } = useTranslation();
  const [calls, setCalls] = useState<any[]>([]);
  const [customer, setCustomer] = useState('');
  const [product, setProduct] = useState('');

  useEffect(()=>{
    setCalls(safeJsonParse<any[]>(localStorage.getItem('call_queue'), []));
  },[]);

  function queueCall(){
    const id = Date.now().toString();
    const entry = { id, customer, product, status: 'scheduled', createdAt: Date.now() };
    const all = safeJsonParse<any[]>(localStorage.getItem('call_queue'), []);
    all.push(entry);
    localStorage.setItem('call_queue', JSON.stringify(all));
    setCalls(all);
    setCustomer(''); setProduct('');
  }

  function simulateCall(id:string){
    const outcome = prompt('Enter outcome: confirmed / cancelled / followup', 'confirmed');
    if (!outcome) return;
    const all = safeJsonParse<any[]>(localStorage.getItem('call_queue'), []);
    const next = all.map((c:any)=> c.id===id ? {...c, status: outcome, answeredAt: Date.now()} : c);
    localStorage.setItem('call_queue', JSON.stringify(next));
    setCalls(next);
  }

  function remove(id:string){
    const all = safeJsonParse<any[]>(localStorage.getItem('call_queue'), []);
    const next = all.filter((c:any)=>c.id!==id);
    localStorage.setItem('call_queue', JSON.stringify(next));
    setCalls(next);
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">{t('admin.calls.title')}</h2>
      <div className="rounded-lg border bg-card p-4 mb-4">
        <h3 className="font-bold">{t('admin.calls.scheduleNew')}</h3>
        <div className="mt-2 grid gap-2 max-w-md">
          <input 
            placeholder={t('admin.calls.customerName')} 
            value={customer} 
            onChange={(e)=>setCustomer(e.target.value)} 
            className="rounded-md border bg-background px-3 py-2" 
          />
          <input 
            placeholder={t('admin.calls.productName')} 
            value={product} 
            onChange={(e)=>setProduct(e.target.value)} 
            className="rounded-md border bg-background px-3 py-2" 
          />
          <div className="flex items-center gap-2">
            <button onClick={queueCall} className="rounded-md bg-primary px-4 py-2 text-primary-foreground">{t('admin.calls.schedule')}</button>
          </div>
        </div>
      </div>

      <div>
        {!calls.length && <div className="text-muted-foreground">{t('admin.calls.noCalls')}</div>}
        <div className="mt-4 space-y-3">
          {calls.map(c=> (
            <div key={c.id} className="rounded-md border bg-card p-3 flex items-center justify-between">
              <div>
                <div className="font-bold">{c.customer} — {c.product}</div>
                <div className="text-sm text-muted-foreground">{c.status}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={()=>simulateCall(c.id)} className="rounded-md border bg-background hover:bg-muted px-3 py-1 text-sm">{t('admin.calls.simulateCall')}</button>
                <button onClick={()=>remove(c.id)} className="rounded-md border bg-background hover:bg-muted px-3 py-1 text-sm">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
