import {refreshAccount} from './modules/account.js';
import {shop,$,$$,t,esc,name,language,save,request,safe,toast,method,changed,icon} from './modules/core.js';
import {renderMenu,renderMeals,renderCart,openCart,closeCart} from './modules/menu.js';
import {checkout} from './modules/checkout.js';
import {showProfile,showHistory,showRestaurant,showPrivacy,track} from './modules/customer.js';

const words={menu:['القائمة','Our menu'],meals:['كوّن وجبتك','Make it a meal'],orders:['طلباتي','My orders'],restaurant:['المطعم','Find us'],heroKicker:['طعم كبير. في كل قضمة.','BIG FLAVOUR. EVERY BITE.'],heroSubtitle:['برجر بتحبه، إضافات على مزاجك، ووجبة تستاهل. اختار طلبك وسيب الباقي علينا.','Big burgers. Your favourite extras. A meal worth getting excited about. Find your next favourite right here.'],orderNow:['اطلب دلوقتي','Order now'],heroNote:['توصيل أو استلام • اختار اللي يناسبك','Delivery or pickup · Your call.'],photoNote:['صور توضيحية مؤقتة','Placeholder photography'],mealEyebrow:['صحبة حلوة لوجبتك','BETTER TOGETHER'],mealTitle:['كملها على مزاجك.','Make a meal of it.'],mealSubtitle:['اختار البرجر والإضافات اللي بتحبها.','Your burger. Your sides. Your perfect combination.'],menuEyebrow:['هتطلب إيه النهارده؟','WHAT ARE YOU CRAVING?'],menuTitle:['كل اللي بتحبه.','Find your favourites.'],payNote:['الدفع عند الاستلام • الأسعار بالجنيه المصري','Pay on receipt · Prices in EGP'],storyEyebrow:['أهلاً بيك في تراك بايت','WELCOME TO TRACK BITE'],storyTitle:['كل قضمة ليها حكاية.','Good food. Great company.'],storyText:['وجبتك على مزاجك، من أول اختيار لحد آخر قضمة.','From your first pick to your last bite, make it a meal to remember.'],faqTitle:['أسئلة على السريع','A few quick answers'],footerTagline:['طعم كبير. في كل قضمة.','Big flavour. Every bite.'],contact:['تواصل معنا','Contact us'],privacy:['الخصوصية','Privacy'],currencyNote:['جميع الأسعار بالجنيه المصري','All prices in Egyptian pounds']};

function renderCopy(){
  document.documentElement.lang=language.lang;document.documentElement.dir=language.lang==='ar'?'rtl':'ltr';document.title=t('تراك بايت | طعم على مزاجك','Track Bite | Big flavour. Every bite.');
  $$('[data-i18n]').forEach(el=>{const pair=words[el.dataset.i18n];if(pair)el.textContent=t(...pair)});
  $('#webTitle').innerHTML=t('جوعان؟<em>إحنا قدّها.</em>','BIG CRAVINGS.<em>BIGGER BITES.</em>');$('#webLanguage').textContent=t('EN','العربية');$('#webLanguage').setAttribute('aria-label',t('Switch to English','التبديل للعربية'));
  $('#profileButton').innerHTML=icon('user');$('#profileButton').setAttribute('aria-label',t('بياناتي وعناويني','My details & addresses'));$('#bagIcon').innerHTML=icon('bag');$('.header-cart').setAttribute('aria-label',t('عرض الطلب','View bag'));$('#searchIcon').innerHTML=icon('search');$('#webSearch').placeholder=t('دوّر على اللي بتحبه…','Search your favourites…');$('#webSearch').setAttribute('aria-label',t('ابحث في القائمة','Search menu'));$('#clearSearch').setAttribute('aria-label',t('مسح البحث','Clear search'));$('#closeCart').setAttribute('aria-label',t('إغلاق السلة','Close bag'));$('#menuSort').setAttribute('aria-label',t('ترتيب القائمة','Sort menu'));
  $('#menuSort').innerHTML=[['default','ترتيب القائمة','Recommended'],['low','السعر: الأقل','Price: low first'],['high','السعر: الأعلى','Price: high first'],['name','الاسم','Name']].map(([id,ar,en])=>`<option value="${id}" ${shop.sort===id?'selected':''}>${t(ar,en)}</option>`).join('');
  const faqs=[['إزاي أطلب؟','How do I order?','اختار طريقة الاستلام، أضف أصنافك للسلة، وعدّل الإضافات. راجع بياناتك والإجمالي، وبعدها أكد الطلب.','Choose pickup or delivery, add your favourites, and customize your extras. Check your details and total, then place your order.'],['أقدر أتابع طلبي؟','Can I track my order?','أيوه! شريط التتبع بيتحدث تلقائياً لما المطعم يغيّر حالة الطلب. تقدر ترجع لطلبك من «طلباتي» على نفس المتصفح.','Yes. The tracker updates when the restaurant changes your order status. Open My orders in this browser to return to it.'],['طرق الدفع إيه؟','How can I pay?','الدفع للمطعم عند استلام الطلب أو التوصيل. كل الرسوم المفعلة بتظهر في ملخص الطلب قبل التأكيد.','Pay the restaurant when you collect your food or receive delivery. All enabled charges appear in your order summary before confirmation.'],['عندي حساسية من بعض المكونات.','What about food allergies?','يرجى التواصل مع المطعم قبل الطلب لتأكيد المكونات ومعلومات الحساسية. تعليمات الطلب لا تضمن خلو الوجبة من مسببات الحساسية.','Please contact the restaurant before ordering to confirm ingredients and allergen information. Order notes do not guarantee an allergen-free meal.'],['أقدر أغيّر طلب اتأكد؟','Can I change a confirmed order?','تواصل مباشرة مع المطعم. التعديل أو الإلغاء بيعتمد على مرحلة تجهيز الطلب.','Contact the restaurant directly. Changes or cancellation depend on how far your order has progressed.']];
  $('#faq').innerHTML=faqs.map(([ar,en,answerAr,answerEn])=>`<details><summary>${t(ar,en)}</summary><p>${t(answerAr,answerEn)}</p></details>`).join('');$('#year').textContent=new Date().getFullYear();
}
function renderMethods(){
  $('#orderMethods').innerHTML=shop.catalog.orderTypes.map(x=>`<button data-method="${esc(x.code||x.id)}" class="${(x.code||x.id)===shop.method?'active':''}" aria-pressed="${(x.code||x.id)===shop.method}">${icon(x.requires_delivery?'delivery':'pickup')}${esc(name(x))}</button>`).join('');
  $$('[data-method]').forEach(b=>b.onclick=()=>{shop.method=b.dataset.method;save('tb_web_method',shop.method);changed()});
  $('#addressButton').innerHTML=icon('pin')+`<span>${esc(method()?.requires_delivery?shop.profile.details?.fullAddress||t('أضف عنوان التوصيل','Add your delivery address'):shop.catalog.settings.restaurant_address||t('تفاصيل الاستلام والمطعم','Pickup & restaurant information'))}</span>`;
  $('#addressButton').onclick=safe(()=>method()?.requires_delivery?showProfile():showRestaurant());
  $('#webStatus').textContent=shop.online?t('نستقبل طلباتك الآن','Taking orders now'):t('الطلب متوقف مؤقتاً','Ordering temporarily paused');$('#webStatus').className='connection '+(shop.online?'online':'offline');
}
function render(){renderCopy();renderMethods();renderMeals();renderMenu();renderCart()}

document.addEventListener('shop:change',()=>{renderMethods();renderCart()});document.addEventListener('shop:refresh-menu',()=>{renderMenu();renderMeals()});document.addEventListener('shop:open-cart',openCart);
$('#webLanguage').onclick=()=>{language.lang=language.lang==='ar'?'en':'ar';localStorage.setItem('tb_lang',language.lang);render();track()};
$('#webSearch').oninput=e=>{shop.query=e.target.value.trim().toLowerCase();renderMenu()};$('#clearSearch').onclick=()=>{shop.query='';$('#webSearch').value='';renderMenu();$('#webSearch').focus()};$('#menuSort').onchange=e=>{shop.sort=e.target.value;renderMenu()};
$('#checkout').onclick=safe(checkout);$('#mobileCart').onclick=openCart;$('#closeCart').onclick=closeCart;$('#cartBackdrop').onclick=closeCart;
const actions={profile:showProfile,history:showHistory,restaurant:showRestaurant,privacy:showPrivacy,cart:openCart};$$('[data-action]').forEach(b=>b.onclick=safe(actions[b.dataset.action]));
let refreshing=false;
async function load(initial=false){
  if(refreshing)return;refreshing=true;
  try{const catalog=await request('/api/public/menu');shop.catalog={products:[],categories:[],modifiers:[],orderTypes:[],settings:{},...catalog};shop.online=!!catalog.online;
    if(!method())shop.method=shop.catalog.orderTypes[0]?.code||shop.catalog.orderTypes[0]?.id||'pickup';
    // Ignore malformed local state; unavailable products remain visible for explicit removal.
    shop.cart=shop.cart.filter(x=>x&&Number.isInteger(x.productId)&&Number.isInteger(x.qty)&&x.qty>0&&x.qty<=99&&(!x.modifiers||Array.isArray(x.modifiers))).map(x=>({...x,modifiers:x.modifiers||[],notes:String(x.notes||'')}));
    if(initial&&!['local','demo-cloud'].includes(shop.catalog.service))await refreshAccount();render();await track();
  }catch(e){shop.online=false;renderMethods();renderCart();if(initial){$('#webProducts').innerHTML=`<div class="empty"><p>${t('تعذر تحميل القائمة. تحقق من الاتصال وحاول مرة أخرى.','Could not load the menu. Check your connection and try again.')}</p><button id="retryMenu">${t('حاول مرة أخرى','Try again')}</button></div>`;$('#retryMenu').onclick=()=>load(true)}}finally{refreshing=false}
}
renderCopy();load(true);
setInterval(async()=>{if(document.hidden)return;try{const health=await request('/api/status');shop.online=shop.catalog.service==='local'?health.ok:health.restaurantOnline;renderMethods();renderCart();await track()}catch{shop.online=false;renderMethods();renderCart()}},10000);
setInterval(()=>{if(!document.hidden&&!$('#dialog').open)load()},45000);
