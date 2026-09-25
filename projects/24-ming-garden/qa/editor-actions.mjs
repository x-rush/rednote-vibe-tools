export async function click(page,action,extra=''){
 const selector='[data-action="'+action+'"]'+extra+':visible';
 if(!await page.locator(selector).count()){
  if(['variant','visualSize','rotate','nudge'].includes(action)){await page.locator('[data-action="details"]:visible').click();}
  else if(action==='select'){await click(page,'objects');await click(page,'selectFromList',extra);return;}
  else if(action==='goal'){await click(page,'journal');}
  else if(action==='area'){await click(page,'waypoints');}
  else {
   if(await page.locator('#modal-root [data-action="close"]:visible').count())await click(page,'close');
   if(['stories','quests','finds','harbor','mountainView'].includes(action))await page.locator('[data-action="moments"]:visible').first().click();
   else {
    await page.locator('[data-action="manage"]:visible').first().click();
    if(!await page.locator(selector).count()&&await page.locator('.growth-more summary:visible').count())await page.locator('.growth-more summary:visible').click();
   }
  }
 }
 const modal=page.locator('#modal-root '+selector);await ((await modal.count())?modal:page.locator(selector)).first().click();
 if(['goal','night','collect'].includes(action)&&await page.locator('#modal-root [data-action="close"]:visible').count())await click(page,'close');
}
