import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeMomentTime,formatMomentTime} from '../src/model.mjs';
const data=JSON.parse(readFileSync(new URL('../src/content/content.json',import.meta.url),'utf8'));
test('moment time formats and calendar bounds survive normalization',()=>{
 for(const [format,expected] of [['now','刚刚'],['minutes','2分钟前'],['hours','2小时前'],['days','2天前'],['yesterday','昨天 18:00'],['weekday','周五 18:00'],['date','9月18日 18:00']])assert.equal(formatMomentTime(normalizeMomentTime({format},null,data),data),expected);
 assert.equal(normalizeMomentTime({month:4,day:31},null,data).day,30);
 assert.equal(normalizeMomentTime({format:'hours',amount:100},null,data).amount,23);
 assert.equal(formatMomentTime(normalizeMomentTime(null,'8分钟前',data),data),'8分钟前');
});
