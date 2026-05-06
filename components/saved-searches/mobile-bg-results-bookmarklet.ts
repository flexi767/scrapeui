import type { MobileBgSearchFieldInput } from "@/lib/mobile-bg/search-results";

export const MOBILE_BG_BROWSER_RESULTS_MESSAGE =
  "scrapeui:mobile-bg-search-results";
export const MOBILE_BG_BROWSER_SEARCH_WINDOW_NAME_PREFIX =
  "scrapeui-mobile-bg-search:";

export interface MobileBgBrowserSearchContext {
  appOrigin: string;
  token: string;
  fields: MobileBgSearchFieldInput[];
}

export interface MobileBgBrowserResultsMessage {
  type: typeof MOBILE_BG_BROWSER_RESULTS_MESSAGE;
  token: string;
  payload: {
    submitted_fields: MobileBgSearchFieldInput[];
    summary_text: string | null;
    page: number;
    total_pages: number | null;
    has_next_page: boolean;
    count_on_page: number;
    loaded_until_page: number;
    ignored_search_result_ids: string[];
    rows: Array<{
      mobile_id: string;
      original_position: number;
      url: string;
      thumb: string | null;
      title: string;
      make: string | null;
      model: string | null;
      dealer_name: string | null;
      dealer_url: string | null;
      current_price: number | null;
      vat_status: "included" | "exempt" | "excluded" | null;
      ad_status: string;
      reg_month: string | null;
      reg_year: string | null;
      body_type: string | null;
      fuel: string | null;
      mileage: number | null;
      transmission: string | null;
      power: number | null;
    }>;
    fallback_note: string;
  };
}

export function buildMobileBgBrowserSearchWindowName(
  context: MobileBgBrowserSearchContext,
) {
  return `${MOBILE_BG_BROWSER_SEARCH_WINDOW_NAME_PREFIX}${JSON.stringify(context)}`;
}

export function buildMobileBgResultsBookmarklet() {
  const source = `(()=>{const TYPE=${JSON.stringify(MOBILE_BG_BROWSER_RESULTS_MESSAGE)},PREFIX=${JSON.stringify(MOBILE_BG_BROWSER_SEARCH_WINDOW_NAME_PREFIX)};let CFG=null;try{const raw=String(window.name||"");if(raw.startsWith(PREFIX))CFG=JSON.parse(raw.slice(PREFIX.length));}catch(e){}if(!CFG||!CFG.appOrigin||!CFG.token){alert("No scrapeui browser-search context found. Open this mobile.bg search from scrapeui, then run the bookmarklet.");return;}const APP=CFG.appOrigin,TOKEN=CFG.token,FIELDS=Array.isArray(CFG.fields)?CFG.fields:[];const fuel=new Set(["Бензинов","Дизелов","Електрически","Хибриден","Plug-in хибрид","Газ","Водород"]),gear=new Set(["Ръчна","Автоматична","Полуавтоматична"]),body=new Set(["Ван","Джип","Кабрио","Комби","Купе","Миниван","Пикап","Седан","Стреч лимузина","Хечбек"]),sortLabels={"1":"Марка/Модел/Цена","3":"Цена","4":"Дата на производство","5":"Пробег","6":"Най-новите обяви","7":"Най-новите обяви от посл. 2 дни"};function abs(u){if(!u)return"";if(u.startsWith("//"))return"https:"+u;if(/^https?:\\/\\//i.test(u))return u;if(u.startsWith("/"))return"https://www.mobile.bg"+u;return u}function txt(r,s){return(r.querySelector(s)?.textContent||"").trim()}function price(t){const m=t.match(/([\\d\\s.,]+)€/);if(!m)return null;const n=m[1].trim().replace(/\\s+/g,"").replace(/,(?=\\d{2}$)/,".").replace(/,/g,""),v=parseFloat(n);return Number.isFinite(v)?v:null}function vat(t,d){if(t.includes("Не се начислява ДДС"))return"exempt";if(t.includes("Цената е без ДДС")||t.includes("без ДДС"))return"excluded";if(t.includes("Цената е с включено ДДС")||t.includes("включено"))return"included";if(t.includes("Освободена")||t.includes("Частна"))return"exempt";return d?null:"exempt"}function ym(r){const m=r.match(/^([^\\d]+?)\\s+(\\d{4})\\s*г\\.?$/i);return m?{reg_month:m[1].trim()||null,reg_year:m[2]||null}:{reg_month:null,reg_year:null}}function mileage(r){const m=r.match(/([\\d\\s]+)\\s*км/i);if(!m)return null;const v=parseInt(m[1].replace(/\\s+/g,""),10);return Number.isFinite(v)?v:null}function power(r){const m=r.match(/(\\d[\\d\\s]*)\\s*к\\.с\\./i);if(!m)return null;const v=parseInt(m[1].replace(/\\s+/g,""),10);return Number.isFinite(v)?v:null}function makeModel(title){const make=(FIELDS.find(f=>f.name==="marka")?.value||"").trim()||null,model=(FIELDS.find(f=>f.name==="model")?.value||"").trim()||null,low=title.trim().toLowerCase();if(make&&model&&low.startsWith((make+" "+model).toLowerCase()))return{make,model};if(make&&low.startsWith(make.toLowerCase())){const rem=title.trim().slice(make.length).trim(),derived=(rem.split("/")[0]||"").trim()||model;return{make,model:derived||null}}return{make,model}}function dealer(item){const a=item.querySelector(".seller .name a"),name=(a?.textContent||"").trim();if(name)return{dealer_name:name,dealer_url:abs(a?.getAttribute("href")||"")||null};const alt=(item.querySelector(".seller .logo img")?.getAttribute("alt")||"").trim().replace(/^лого\\s+/i,"").trim();if(alt&&alt!=="Регион:")return{dealer_name:alt,dealer_url:null};return{dealer_name:null,dealer_url:null}}function summary(raw){if(!raw)return null;const sort=FIELDS.find(f=>f.name==="f20")?.value,label=sort&&sortLabels[sort];let out=raw.replace(/Година на производство от:\\s*/gu,"Год.: ").replace(/Година на производство до:\\s*/gu,"Год. до: ");return label?out.replace(/Подредени по:\\s*[^,]+$/u,"Подредени по: "+label):out}try{const rows=Array.from(document.querySelectorAll(".ads2023 .item")).map((item,i)=>{const a=item.querySelector(".zaglavie a.title"),imgA=item.querySelector("a.image"),url=abs(a?.getAttribute("href")||imgA?.getAttribute("href")||""),id=(url.match(/obiava-(\\d+)/)||[])[1]||(item.id||"").replace(/^ida/,""),title=(a?.textContent||"").trim(),params=Array.from(item.querySelectorAll(".params span")).map(s=>(s.textContent||"").trim()).filter(Boolean),d=dealer(item),y=ym(params[0]||""),mm=makeModel(title),thumb=abs(item.querySelector(".photo .big img.pic")?.getAttribute("src")||item.querySelector(".photo .big img:last-child")?.getAttribute("src")||""),priceText=txt(item,".zaglavie .price");return{mobile_id:id,original_position:i+1,url,thumb:thumb||null,title,make:mm.make,model:mm.model,dealer_name:d.dealer_name,dealer_url:d.dealer_url,current_price:price(priceText),vat_status:vat(priceText,d.dealer_name),ad_status:item.classList.contains("TOP")?"TOP":item.classList.contains("VIP")?"VIP":"none",reg_month:y.reg_month,reg_year:y.reg_year,body_type:params.find(v=>body.has(v))||null,fuel:params.find(v=>fuel.has(v))||null,mileage:params.map(mileage).find(v=>v!=null)??null,transmission:params.find(v=>gear.has(v))||null,power:params.map(power).find(v=>v!=null)??null}}).filter(r=>r.mobile_id&&r.url.includes("/obiava-")&&r.title);const page=parseInt(txt(document,".pagination .selected"),10)||1,pages=Array.from(document.querySelectorAll(".pagination a,.pagination div")).map(e=>parseInt((e.textContent||"").trim(),10)).filter(Number.isFinite),payload={submitted_fields:FIELDS,summary_text:summary(txt(document,".resultsInfoBox #paramsFromSearchText")),page,total_pages:pages.length?Math.max(...pages):null,has_next_page:!!document.querySelector(".pagination a.next"),count_on_page:rows.length,loaded_until_page:page,ignored_search_result_ids:[],rows,fallback_note:rows.length?"Parsed inside the mobile.bg browser page and imported with the bookmarklet.":"Parsed inside the mobile.bg browser page, but found 0 rows. Diagnostics: title="+document.title+", items="+document.querySelectorAll(".ads2023 .item").length+", url="+location.href};if(window.opener){window.opener.postMessage({type:TYPE,token:TOKEN,payload},APP);alert("Imported "+rows.length+" mobile.bg results into scrapeui.");}else alert("No scrapeui opener window was found. Open the search from scrapeui first, then run this bookmarklet.");}catch(e){const msg="Could not parse mobile.bg results: "+(e&&e.message?e.message:e),payload={submitted_fields:FIELDS,summary_text:document.title||null,page:1,total_pages:null,has_next_page:false,count_on_page:0,loaded_until_page:1,ignored_search_result_ids:[],rows:[],fallback_note:msg+" Diagnostics: url="+location.href};if(window.opener)window.opener.postMessage({type:TYPE,token:TOKEN,payload},APP);alert(msg);}})();`;

  return `javascript:${source}`;
}
