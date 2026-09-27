import {shop,$,$$,t,esc,name,money,toast,safe,dialog,input,select,read,save,request,method,subtotal,product,changed,icon} from './core.js';
import {fields as deliveryFields,values as deliveryValues,fill as fillDelivery} from '/shared/delivery.js';
import {totals,priceSummary,validLine,closeCart} from './menu.js';
import {rememberAddress,track} from './customer.js';

export async function checkout(){
  closeCart();
  const fresh=await request('/api/public/menu');shop.catalog={...shop.catalog,...fresh};shop.online=!!fresh.online;changed();
  if(!shop.online)throw new Error(t('الطلب متوقف مؤقتاً. حاول مرة أخرى بعد قليل.','Ordering is temporarily paused. Please try again shortly.'));
  if(!shop.cart.length||!shop.cart.every(validLine))throw new Error(t('راجع الأصناف غير المتاحة في سلتك','Please review unavailable items in your bag'));
  if(!method()){shop.method=shop.catalog.orderTypes[0]?.code||shop.catalog.orderTypes[0]?.id;changed()}
  if(!method())throw new Error(t('طرق الاستلام غير متاحة حالياً','No order methods are available'));
  let step=0,busy=false,draft={...shop.profile,details:{...shop.profile.details},notes:''};
  const el=$('#dialog');
  function draw(){
    const delivery=!!method()?.requires_delivery;
    const steps=[t('بياناتك','Your details'),t('الدفع','Payment'),t('مراجعة وتأكيد','Review & confirm')];
    el.innerHTML=`<form id="checkoutForm"><div class="dialog-head"><h2>${t('إتمام الطلب','Checkout')}</h2><button type="button" id="dialogClose" aria-label="${t('إغلاق','Close')}">×</button></div><div class="checkout-steps">${steps.map((x,i)=>`<span class="${i<=step?'active':''}" ${i===step?'aria-current="step"':''}>${i+1}. ${x}</span>`).join('')}</div><div class="form-grid" id="checkoutBody"></div><div class="checkout-actions">${step?`<button type="button" id="checkoutBack">${t('رجوع','Back')}</button>`:''}<button type="submit" id="checkoutNext" class="primary">${step===2?t('تأكيد الطلب','Place order'):t('متابعة','Continue')}</button></div><p class="dialog-error" role="alert"></p></form>`;
    const body=$('#checkoutBody');
    if(step===0){
      body.innerHTML=select('orderType',t('طريقة الاستلام','Order method'),shop.catalog.orderTypes,shop.method)+input('customerName',t('الاسم','Your name'),'text',draft.customerName||'','required maxlength="100" autocomplete="name"')+`<div id="deliveryFields">${deliveryFields()}</div>`+input('notes',t('ملاحظات الطلب (اختياري)','Order notes (optional)'),'text',draft.notes||'','maxlength="500"');
      $('[name=customerPhone]',el).value=draft.customerPhone||'';$('[name=customerPhone]',el).required=true;$('[name=customerPhone]',el).autocomplete='tel';$('[name=customerPhone]',el).pattern='[+0-9 ]{7,20}';fillDelivery(draft.details,el);
      const addresses=$('#savedAddresses');addresses.hidden=!delivery;addresses.innerHTML=shop.addresses.length?select('savedAddress',t('عنوان محفوظ','Saved address'),[{id:'',name_ar:'أدخل عنواناً جديداً',name_en:'Enter a new address'},...shop.addresses.map((a,i)=>({id:String(i),name_ar:a.label+' · '+a.fullAddress,name_en:a.label+' · '+a.fullAddress}))]):'';
      if($('[name=savedAddress]'))$('[name=savedAddress]').onchange=e=>{if(e.target.value!=='')fillDelivery(shop.addresses[Number(e.target.value)],el)};
      for(const label of $$('#deliveryFields label')){const key=$('input',label)?.name;if(key)label.hidden=!delivery&&key!=='customerPhone'}$('#deliveryFields details').hidden=!delivery;$('[name=fullAddress]',el).required=delivery;
      if(!delivery)body.insertAdjacentHTML('beforeend',`<p class="notice">${esc(shop.catalog.settings.restaurant_address||t('يرجى تأكيد عنوان الاستلام مع المطعم قبل الزيارة.','Please confirm the pickup address with the restaurant before visiting.'))}</p>`);
      $('[name=orderType]',el).onchange=e=>{capture();shop.method=e.target.value;save('tb_web_method',shop.method);changed();draw()};
    }else if(step===1){body.innerHTML=`<div class="review-box"><label class="check"><input type="radio" name="payment" value="cash" checked>${icon('check')} ${delivery?t('الدفع عند التوصيل','Pay on delivery'):t('الدفع عند الاستلام','Pay at pickup')}</label><p class="product-description">${t('ادفع للمطعم عند استلام طلبك.','Pay the restaurant when you receive your order.')}</p></div>${priceSummary()}`;
    }else{body.innerHTML=`<div class="review-box"><strong>${esc(name(method()))} · ${esc(draft.customerName)}</strong><p dir="auto">${esc(draft.customerPhone)}</p><p>${esc(delivery?draft.details.fullAddress:shop.catalog.settings.restaurant_address||'')}</p>${draft.notes?`<p>${esc(draft.notes)}</p>`:''}</div><div>${shop.cart.map(x=>`<div class="review-line"><div>${x.qty} × ${esc(name(product(x.productId)))}<small>${esc((x.modifiers||[]).map(id=>name(shop.catalog.modifiers.find(m=>m.id===id))).join(' · '))}${x.notes?' · '+esc(x.notes):''}</small></div></div>`).join('')}</div>${priceSummary()}<p class="notice">${t('الدفع عند الاستلام. بعد التأكيد سيصل طلبك إلى المطعم للتحضير.','Pay when you receive your order. Once confirmed, your order is sent to the restaurant for preparation.')}</p>`}
    $('#dialogClose').onclick=()=>{if(!busy)el.close()};if($('#checkoutBack'))$('#checkoutBack').onclick=()=>{step--;draw()};
    $('#checkoutForm').onsubmit=async e=>{e.preventDefault();if(busy)return;try{if(step===0){capture();draft.customerName=draft.customerName.trim();if(!draft.customerName)throw new Error(t('اكتب اسمك','Please enter your name'));if(delivery&&!draft.details.fullAddress.trim())throw new Error(t('اكتب العنوان الكامل','Please enter your full address'))}if(step<2){step++;draw();return}await submit()}catch(error){$('.dialog-error',el).textContent=error.message}};
  }
  function capture(){if(step!==0)return;const b=Object.fromEntries(new FormData($('#checkoutForm')));draft={...draft,customerName:b.customerName,customerPhone:b.customerPhone,notes:b.notes,details:deliveryValues(el)}}
  async function submit(){
    busy=true;$('#checkoutNext').disabled=true;$('#checkoutBack').disabled=true;$('#dialogClose').disabled=true;
    try{
      const delivery=!!method()?.requires_delivery;
      const body={items:shop.cart.map(({productId,qty,modifiers,notes})=>({productId,qty,modifiers,notes})),customerName:draft.customerName,customerPhone:draft.customerPhone,orderType:shop.method,deliveryDetails:delivery?draft.details:{},deliveryAddress:delivery?draft.details.fullAddress:null,notes:draft.notes,expectedTotal:totals().total,rewardId:shop.reward?.id||null};
      const fingerprint=JSON.stringify(body);let pending=read('tb_web_pending',null);if(!pending||pending.fingerprint!==fingerprint)pending={fingerprint,id:crypto.randomUUID()};save('tb_web_pending',pending);
      const {order}=await request(shop.catalog.service==='local'?'/api/public/orders':'/api/orders',{...body,requestId:pending.id});
      const history={...order,date:new Date().toISOString(),items:body.items.map(x=>({...x,snapshot:{name_ar:product(x.productId)?.name_ar,name_en:product(x.productId)?.name_en}}))};
      shop.history=[history,...shop.history.filter(o=>o.trackingToken!==order.trackingToken)].slice(0,50);if(!shop.account)save('tb_web_history',shop.history);localStorage.setItem('tb_tracking',order.trackingToken);localStorage.removeItem('tb_web_pending');
      shop.profile={customerName:draft.customerName,customerPhone:draft.customerPhone,details:delivery?draft.details:shop.profile.details||{}};if(!shop.account)save('tb_delivery',shop.profile);if(delivery){if(shop.account)await request('/api/account/addresses',draft.details);else rememberAddress(draft.details);}shop.reward=null;
      shop.cart=[];changed();el.close();await track(order.trackingToken,true);
      await dialog(t('طلبك وصل!','Order received!'),`<div class="success-copy"><div class="success-mark">${icon('check')}</div><h3>#${order.sequential_no}</h3><p>${t('شكراً ليك! تابع تجهيز طلبك من شريط التتبع.','Thank you! Follow your order’s progress in the tracker.')}</p><p><strong>${money(order.total)}</strong> · ${t('الدفع عند الاستلام','Pay on receipt')}</p></div>`,()=>{},t('متابعة طلبي','Follow my order'));
    }finally{busy=false;if($('#checkoutNext'))$('#checkoutNext').disabled=false;if($('#checkoutBack'))$('#checkoutBack').disabled=false;if($('#dialogClose'))$('#dialogClose').disabled=false}
  }
  const prevent=e=>{if(busy)e.preventDefault()};el.addEventListener('cancel',prevent);el.addEventListener('close',()=>el.removeEventListener('cancel',prevent),{once:true});draw();el.showModal();
}
