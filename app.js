const SUPABASE_URL='https://wjpvhabylmfoyiamxfmz.supabase.co';
const SUPABASE_KEY='sb_publishable_9uE37OzD7zwp-nu6JEFBDA_SDe5AMbs';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let cloudUser=null;
const KEY='dh-recipes-v1', SHOP='dh-shop-v1';
const seed=[
{id:crypto.randomUUID(),name:'Garlic Sourdough',category:'Sides',serves:4,fav:true,ingredients:['4 thick slices sourdough','3 tbsp olive oil','2 tsp chopped garlic','Pinch of salt','Black pepper'],method:['Heat the oven to 200°C.','Mix the olive oil, garlic, salt and pepper.','Brush generously over the sourdough.','Bake for 8–10 minutes until crisp at the edges.']},
{id:crypto.randomUUID(),name:'Spicy Chorizo & Prawn Tomato Pasta',category:'Pasta',serves:4,fav:false,ingredients:['150g chorizo, diced','200–300g cooked prawns','1 onion, finely chopped','3–4 garlic cloves, crushed','2 x 400g tins chopped tomatoes','350–400g pasta','½ beef stock cube','1 tsp paprika','1 tsp mixed herbs','½ tsp thyme','Small pinch cayenne pepper','Black pepper','1 tsp balsamic vinegar','Small knob of butter'],method:['Cook the chorizo for 3–4 minutes until it releases its oil.','Add the onion and cook for 6–8 minutes in the chorizo oil, then add the garlic and cook for 30–60 seconds.','Add the chopped tomatoes, paprika, mixed herbs, thyme, cayenne and black pepper. Dissolve ½ beef stock cube in a small splash of hot water and add it to the sauce.','Simmer for 20–25 minutes.','Cook the pasta according to the packet instructions and reserve a little pasta water before draining.','Add the cooked prawns to the tomato and chorizo sauce for the final 2–3 minutes only, just long enough to heat through.','Stir in the balsamic vinegar and a small knob of butter.','Toss the pasta through the sauce, adding a splash of reserved pasta water if needed, and serve.']},
{id:crypto.randomUUID(),name:'Tomato, Olive & Herb Bruschetta',category:'Starters & Sides',serves:4,fav:false,ingredients:['300g cherry tomatoes, quartered','120g pitted green olives, sliced','½ small red onion, very finely chopped','5 sun-dried tomatoes, chopped','1 garlic clove, crushed','15g fresh parsley, finely chopped','10g fresh dill, finely chopped','60ml extra-virgin olive oil','2 tbsp pomegranate molasses or balsamic vinegar','50g finely grated Parmesan','Salt and black pepper','½ sourdough or ciabatta loaf, sliced'],method:['Mix the tomatoes, olives, red onion, sun-dried tomatoes, garlic, parsley and dill in a bowl.','Add the olive oil and pomegranate molasses or balsamic vinegar and mix thoroughly.','Stir through the Parmesan, season with salt and plenty of black pepper, then taste and adjust the acidity if needed.','Lightly drizzle the bread with olive oil and toast or pan-fry until golden and crisp.','Spoon the tomato and olive mixture generously over the warm bread and serve immediately.','Note: Best served immediately — do not leave the bread sitting in the dressing or it will go soggy.']}
];
let recipes=JSON.parse(localStorage.getItem(KEY)||'null')||seed, view='recipes', cat='All';
// One-time migration from the original two starter recipes to the updated cookbook.
// Personal recipes are left untouched.
const MIGRATION_KEY='dh-migration-v5';
if(!localStorage.getItem(MIGRATION_KEY)){
  const oldPasta=recipes.find(r=>r.name==='Chorizo Tomato Pasta');
  const hasNewPasta=recipes.some(r=>r.name==='Spicy Chorizo & Prawn Tomato Pasta');
  const hasBruschetta=recipes.some(r=>r.name==='Tomato, Olive & Herb Bruschetta');
  if(oldPasta && !hasNewPasta){
    const replacement={...seed[1],id:oldPasta.id,fav:!!oldPasta.fav};
    recipes=recipes.map(r=>r.id===oldPasta.id?replacement:r);
  }
  if(!hasBruschetta) recipes.push(seed[2]);
  localStorage.setItem(MIGRATION_KEY,'1');
}

const $=s=>document.querySelector(s), recipesEl=$('#recipes'), shopping=$('#shopping');
function save(){
  localStorage.setItem(KEY,JSON.stringify(recipes));
  if(cloudUser) uploadRecipesToCloud();
}
save();
async function uploadRecipesToCloud(){
  if(!cloudUser) return;

  const cloudRecipes=recipes.map(r=>({
    id:r.id,
    user_id:cloudUser.id,
    name:r.name,
    category:r.category||'Other',
    serves:r.serves||4,
    fav:!!r.fav,
    ingredients:r.ingredients,
    method:r.method,
    updated_at:new Date().toISOString()
  }));

  const {error}=await db
    .from('recipes')
    .upsert(cloudRecipes);

  if(error) alert('Cloud upload failed: ' + error.message);
}

async function startCloudSync(){
  const {data:{session}}=await db.auth.getSession();
  if(!session) return;

  cloudUser=session.user;

  const {data:cloudRecipes,error}=await db
    .from('recipes')
    .select('*')
    .order('updated_at',{ascending:false});

  if(error){
    console.error('Cloud load error:',error);
    return;
  }

  if(cloudRecipes.length===0){
    await uploadRecipesToCloud();
    console.log('Local cookbook uploaded to cloud.');
    return;
  }

  recipes=cloudRecipes.map(r=>({
    id:r.id,
    name:r.name,
    category:r.category,
    serves:r.serves,
    fav:r.fav,
    ingredients:r.ingredients,
    method:r.method
  }));

  localStorage.setItem(KEY,JSON.stringify(recipes));
  render();
}
function categories(){return ['All',...new Set(recipes.map(r=>r.category).filter(Boolean))]}
function render(){ const q=$('#search').value.toLowerCase(); $('#cats').innerHTML=categories().map(c=>`<button class="${c===cat?'active':''}" data-cat="${c}">${c}</button>`).join('');
let list=recipes.filter(r=>(view!=='favs'||r.fav)&&(cat==='All'||r.category===cat)&&(`${r.name} ${r.ingredients.join(' ')}`.toLowerCase().includes(q))); recipesEl.innerHTML=list.map(r=>`<div class="card" data-id="${r.id}"><button class="heart" data-heart="${r.id}">${r.fav?'♥':'♡'}</button><div><small>${esc(r.category||'Recipe')}</small><h3>${esc(r.name)}</h3></div><div class="meta">Serves ${r.serves||'—'} · ${r.ingredients.length} ingredients</div></div>`).join('')||'<p>No recipes found.</p>'; recipesEl.classList.toggle('hidden',view==='shopping'); shopping.classList.toggle('hidden',view!=='shopping'); if(view==='shopping') renderShop();}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function openForm(r){$('#formTitle').textContent=r?'Edit Recipe':'Add Recipe'; $('#rid').value=r?.id||''; $('#name').value=r?.name||''; $('#category').value=r?.category||''; $('#serves').value=r?.serves||4; $('#ingredients').value=r?.ingredients.join('\n')||''; $('#method').value=r?.method.join('\n')||''; $('#modal').showModal()}
function detail(r){$('#detailBody').innerHTML=`<div class="detailTop"><button type="button" onclick="closeDetail()" aria-label="Close recipe">✕</button><button onclick="toggleFav('${r.id}')">${r.fav?'♥':'♡'}</button></div><small>${esc(r.category)}</small><h1>${esc(r.name)}</h1><p>Serves ${r.serves}</p><div class="actions"><button onclick="addShop('${r.id}')">Add ingredients</button><button class="secondary" onclick="editRecipe('${r.id}')">Edit</button></div><h2>Ingredients</h2><ul class="ingredients">${r.ingredients.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><h2>Method</h2><ol class="steps">${r.method.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><div class="actions"><button class="secondary" onclick="deleteRecipe('${r.id}')">Delete recipe</button></div>`; $('#detail').showModal()}
window.closeDetail=()=>{const d=$('#detail');if(d.open)d.close()};
window.toggleFav=id=>{let r=recipes.find(x=>x.id===id);r.fav=!r.fav;save();render();if($('#detail').open)detail(r)}; window.editRecipe=id=>{let r=recipes.find(x=>x.id===id);$('#detail').close();openForm(r)}; window.deleteRecipe=id=>{if(confirm('Delete this recipe?')){recipes=recipes.filter(x=>x.id!==id);save();$('#detail').close();render()}};
window.addShop=id=>{let r=recipes.find(x=>x.id===id), items=JSON.parse(localStorage.getItem(SHOP)||'[]');items.push(...r.ingredients.map(text=>({text,done:false})));localStorage.setItem(SHOP,JSON.stringify(items));alert('Ingredients added to your shopping list.')};
function renderShop(){let items=JSON.parse(localStorage.getItem(SHOP)||'[]');$('#shopItems').innerHTML=items.length?items.map((x,i)=>`<label class="shoprow"><input type="checkbox" data-shop="${i}" ${x.done?'checked':''}><span>${esc(x.text)}</span></label>`).join(''):'<p>Your shopping list is empty.</p>'}
$('#recipeForm').onsubmit=e=>{e.preventDefault();let id=$('#rid').value||crypto.randomUUID(), old=recipes.find(r=>r.id===id);let r={id,name:$('#name').value.trim(),category:$('#category').value.trim()||'Other',serves:+$('#serves').value||1,fav:old?.fav||false,ingredients:$('#ingredients').value.split('\n').map(x=>x.trim()).filter(Boolean),method:$('#method').value.split('\n').map(x=>x.trim()).filter(Boolean)};recipes=old?recipes.map(x=>x.id===id?r:x):[r,...recipes];save();$('#modal').close();render()};
$('#cancel').onclick=()=>$('#modal').close(); $('#addTop').onclick=$('#addNav').onclick=()=>openForm(); $('#search').oninput=render; $('#cats').onclick=e=>{if(e.target.dataset.cat){cat=e.target.dataset.cat;render()}}; recipesEl.onclick=e=>{let h=e.target.dataset.heart;if(h){e.stopPropagation();toggleFav(h);return}let c=e.target.closest('.card');if(c)detail(recipes.find(r=>r.id===c.dataset.id))};
document.querySelector('nav').onclick=e=>{let b=e.target.closest('[data-view]');if(!b)return;view=b.dataset.view;document.querySelectorAll('nav [data-view]').forEach(x=>x.classList.toggle('active',x===b));render()}; $('#clearShop').onclick=()=>{localStorage.removeItem(SHOP);renderShop()}; $('#shopItems').onchange=e=>{if(e.target.dataset.shop!==undefined){let a=JSON.parse(localStorage.getItem(SHOP)||'[]');a[+e.target.dataset.shop].done=e.target.checked;localStorage.setItem(SHOP,JSON.stringify(a))}};render();

// Import and backup tools
const tools=$('#tools');
$('#toolsNav').onclick=()=>tools.showModal();
$('#closeTools').onclick=()=>tools.close();
function parseRecipeBlock(text){
  const lines=text.replace(/\r/g,'').split('\n').map(x=>x.trim());
  const field=(name, fallback='')=>{const x=lines.find(l=>l.toLowerCase().startsWith(name.toLowerCase()+':'));return x?x.slice(x.indexOf(':')+1).trim():fallback};
  const section=(start,names)=>{let i=lines.findIndex(l=>l.toLowerCase()===start.toLowerCase()+':');if(i<0)return[];let out=[];for(i++;i<lines.length;i++){if(names.some(n=>lines[i].toLowerCase()===n.toLowerCase()+':'))break;if(lines[i])out.push(lines[i].replace(/^[-•]\s*/, '').replace(/^\d+[.)]\s*/,''));}return out};
  const name=field('Name')||field('Recipe');
  const category=field('Category','Other');
  const serves=parseInt(field('Serves','4'),10)||4;
  const ingredients=section('Ingredients',['Method','Note','Notes']);
  const method=section('Method',['Ingredients','Note','Notes']);
  const note=field('Note')||field('Notes');
  if(note) method.push('Note: '+note);
  if(!name||!ingredients.length||!method.length) throw new Error('Use Name, Ingredients and Method headings in the recipe block.');
  return {id:crypto.randomUUID(),name,category,serves,fav:false,ingredients,method};
}
$('#importBtn').onclick=()=>{try{const r=parseRecipeBlock($('#importText').value);recipes=[r,...recipes];save();cat='All';view='recipes';render();tools.close();$('#importText').value='';alert(`${r.name} has been added to your cookbook.`)}catch(e){alert('I couldn’t read that recipe. '+e.message)}};
$('#exportBtn').onclick=()=>{const payload={app:'The Duhig-Hyde Cook Book',version:1,exported:new Date().toISOString(),recipes};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`duhig-hyde-cookbook-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
$('#backupImportBtn').onclick=()=>$('#backupFile').click();
$('#backupFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());const incoming=Array.isArray(data)?data:data.recipes;if(!Array.isArray(incoming))throw new Error();if(!confirm(`Restore ${incoming.length} recipes from this backup? This will replace the recipes currently on this device.`))return;recipes=incoming;save();render();tools.close();alert('Cookbook restored.')}catch{alert('That does not look like a valid Duhig-Hyde Cook Book backup.')}finally{e.target.value=''}};
async function cookbookLogin(){
  const {data:{session}}=await db.auth.getSession();

  if(session){
    await startCloudSync();
    return;
  }

  const email=prompt('Cookbook email address:');
  if(!email) return;

  const password=prompt('Cookbook password:');
  if(!password) return;

  const {error}=await db.auth.signInWithPassword({
    email:email.trim(),
    password
  });

  if(error){
    alert('Could not sign in to the cookbook. Please check the email and password.');
    console.error(error);
    return;
  }

  await startCloudSync();
}

cookbookLogin();
