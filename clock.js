const axios = require('axios');
const CronJob = require('cron').CronJob;
const cryptospotlightScript = require('./cryptospotlightScript').script;

console.log('Before job instantiation');
const job = new CronJob('* * * * *', function() {
  const d = new Date();
  console.log('Every Minute:', d);
  cryptospotlightScript();
});
console.log('After job instantiation');
job.start();

