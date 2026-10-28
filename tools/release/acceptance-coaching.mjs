import assert from 'node:assert/strict';
import { expect } from '@playwright/test';

// Ordinary authenticated routes; the enclosing fixture owns synthetic cleanup.
export async function runCoachingJourney({ context, origin, runId, enabled }) {
  const page = await context.newPage();
  const title = `Synthetic coaching ${runId}`;
  await page.goto(origin + '/');
  await page.getByRole('button', { name: 'New position focus', exact: true }).click();
  await page.getByLabel('Document title').fill(title);
  await page.getByLabel('Period starts').fill('2026-10-01');
  await page.getByLabel('Period ends').fill('2027-03-31');
  await page.getByRole('button', {name:'Save changes',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  assert.equal(typeof enabled, 'boolean');
  const focusId = new URL(page.url()).searchParams.get('focus');
  assert.ok(focusId);
  async function modelTurn(button) {
    const [response] = await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === '/api/coach/suggest'
        && response.request().method() === 'POST', { timeout: 60000 }), button.click(),
    ]);
    assert.equal(response.status(),200);
    await expect(page.getByRole('dialog')).toBeHidden({timeout:60000});
  }
  let targetDate;
  if (enabled) {
    await page.getByRole('button',{name:'Help me get started',exact:true}).click();
    await page.getByLabel('Your project work',{exact:true}).fill('I maintain a synthetic build diagnostics tool for engineers. I can review three failed builds with them and record which troubleshooting steps help.');
    const next=page.getByRole('button',{name:'Next',exact:true});
    await modelTurn(next);
    const objectiveField=page.getByLabel('Objective',{exact:true}),answer=page.getByLabel('Your answer',{exact:true});
    for(let turn=0;turn<3;turn++) {
      await expect(objectiveField.or(answer)).toBeVisible();
      if(await objectiveField.isVisible())break;
      await answer.fill('Engineers benefit by finding failed build causes sooner. I own the messages and can review three failures with them, recording useful next steps.');
      await modelTurn(next);
    }
    assert.ok((await objectiveField.inputValue()).trim());
    await page.getByRole('radio',{name:'Contribution',exact:true}).check();
    await page.getByRole('button',{name:'Use suggestion',exact:true}).click();
  } else {
    const response=await context.request.post(origin+'/api/coach/suggest',{headers:{Origin:origin},data:{},timeout:10000});
    assert.equal(response.status(),503);
    await page.getByRole('button',{name:'Add objective',exact:true}).click();
    await page.getByLabel('Objective',{exact:true}).fill('Help engineers diagnose synthetic build failures.');
  }
  await expect(page.getByRole('checkbox', {name:'Other — none of these apply', exact:true})).toBeVisible();
  const objective=await page.getByLabel('Objective',{exact:true}).inputValue();
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button',{name:'+ Add SMART goal',exact:true}).click();
  if(enabled){
    await page.getByRole('button',{name:'Help me write this',exact:true}).click();
    await modelTurn(page.getByRole('button',{name:'Suggest actions',exact:true}));
    await page.getByRole('radio').first().check();
    await page.getByRole('button',{name:'Next',exact:true}).click();
    targetDate=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
    await page.getByLabel('Aim for',{exact:true}).fill(targetDate);
    await modelTurn(page.getByRole('button',{name:'Next',exact:true}));
    assert.ok((await page.getByLabel('Goal',{exact:true}).inputValue()).trim());
    await page.getByRole('button',{name:'Use suggestion',exact:true}).click();
  }else await page.getByLabel('SMART goal',{exact:true}).fill('Review three synthetic build failures and record useful diagnostic steps.');
  const goal=await page.getByLabel('SMART goal',{exact:true}).inputValue();
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.reload();
  await expect(page.getByText(objective,{exact:true})).toBeVisible();
  await expect(page.getByText(goal,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Review whole focus',exact:true}).click();
  await page.getByRole('button',{name:'Send request',exact:true}).click();
  await expect.poll(async()=>{
    const response=await context.request.get(origin+'/api/coach/focuses/'+focusId,{timeout:10000});
    assert.equal(response.status(),200);const record=await response.json();
    assert.equal(record.focus.title,title);
    return record.requests.at(-1)?.document.sections[0]?.goals[0];
  }).toBe(goal);
  await page.close();
}
