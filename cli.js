#!/usr/bin/env node

/**
 * Module dependencies.
 */

var program = require('commander');

program
  .version('0.1.0')
  .option('-D, --deploy', 'Deploy')
  .option('-S, --service [vars_file]', 'Generate config')
  .option('-P, --proxy [env]', 'Generate config')
  .option('--database [action] [code]', 'Generate config')
  .option('--app-code [code]', 'Generate config')
  .option('--app-iteration [iteration]', 'Generate config')
  .parse(process.argv);

const appCode = program.appCode,
      appIteration = program.appCode;

if(program.service) {
  console.log('generate config file for service', program.service);
}

if(program.proxy) {
  console.log('generate proxy config for env', program.proxy);
}

if(program.deploy) {
  require('./lib/deploy')
}

if(program.database) {
  if(!appCode) {
    return console.log('required arguments : --app-code');
  }
  console.log(program);
  const db_name = `auto-db-${appCode}`,
        db_user = `auto-user-${appCode}`;
  switch(program.database) {
    case "create":
      console.log(`create db ${db_name} with user ${db_user}`);
      break;
    case "drop":
      console.log(`drop db ${db_name} and user ${db_user}`);
      break;
    case "point-in-time":
    case "dump":
      console.log('not implemented yet');
      break;
    default:
      console.log('unknown method');
      break;
  }
}
