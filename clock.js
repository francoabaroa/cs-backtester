const axios = require('axios');
const CronJob = require('cron').CronJob;

console.log('Before job instantiation');
const job = new CronJob('* * * * *', function() {
  const d = new Date();
  console.log('Every Minute:', d);
});
console.log('After job instantiation');

job.start();

axios.get('https://cs-price-alerts.herokuapp.com/check/14157012311').then(res => {
  console.log('res', res);
}).catch(function (error) {
  console.log(error);
});


setTimeout(function(){ job.stop(); console.log('done running') }, 300000);
