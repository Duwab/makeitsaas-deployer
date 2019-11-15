import * as program from 'commander';
import { App } from '../app/app';
import { CliHelper, ConfigReader } from '@utils';
import { Playbook } from '@ansible';
import { DeployServiceTask } from '@custom-modules/workflows/steps/deploy-service.task';
import { PipelineModule } from '../src/domains/pipeline/pipeline.module';
import { Order } from '@entities';
import { FakeOrders } from '@fake';
import { ModeLoader } from '../src/core/mode/cli-mode-loader';
import { InfrastructureModule } from '../src/domains/infrastructure/infrastructure.module';

program
    .version('0.1.0')
    .option('--mode [mode]', 'Environment type (prod, test, local)')
    .option('--test', 'What your do for testing')
    .option('--ansible', 'Prepare ansible playbook')
    .option('--playbook [playbookName]', 'Specify ansible playbook name')
    .option('-X, --execute', 'Combined with --ansible, executes the freshly created playbook')
    .option('-i, --interactive', 'Creates a sequence from order')
    .option('--order [orderId]', 'Creates a sequence from order')
    .option('--sequence [sequenceId]', 'Runs a sequence')
    .option('--environment [environmentId]', 'Environment Id')
    .option('--service [serviceId]', 'Service Id')
    .option('--drop', 'Associated with environment id, will drop deployment')
    .parse(process.argv);

ModeLoader(program);

const app = new App();

app.ready.then(() => {
    // maybe add below a script to display operations that needs to be led
    if (program.test) {
        let infra = new InfrastructureModule();
        return infra.test().then(() => {
            // app.exit();
        });
    } else if (program.order) {
        console.log('program.order =', program.order);
        /**
         * TODO :
         * - Execute playbooks for real
         * - gather/store data from playbooks
         * - list possible behaviors
         * - make diagrams for these possible behaviors (processes, modules hierarchy, ...)
         * - create servlet to take external orders (network rules => no authentication)
         *      - orders create/update environment
         *      - orders delete environment
         *      - orders service recovering
         *      - gather workflow reports
         *      - response => status + workflow id
         * - deploy spa & cdn
         * - data pipelines + ML (step = read/transform/save mongo documents)
         * - BP : mis + architecture-ready-to-use
         */
            // app.createSequence(parseInt(program.order)).then(() => {
            //     app.exit();
            // });
        const o = new Order(FakeOrders[parseInt(program.order)]);
        o.saveDeep().then(o => {
            const pipelineModule = new PipelineModule();
            return pipelineModule
                .processOrder(o)
        });
    } else if (program.testMore) {
        console.log('test');
        let task = new DeployServiceTask();
        task.run().then(() => {
            console.log('exit');
            app.exit();
        });
    } else if (program.ansible) {
        let playbookReference: string;
        let serviceUuid: string;
        let environmentUuid: string;

        const getPlaybookReference = async (): Promise<string> => {
            if (program.playbook) {
                playbookReference = program.playbook;
            } else {
                playbookReference = await CliHelper.askList(ConfigReader.playbooks.getKeys());
            }

            return playbookReference;
        };
        const getServiceUuid = async (): Promise<string> => {
            if (program.service) {
                serviceUuid = program.service;
            } else {
                serviceUuid = await CliHelper.askInteractively('Service uuid (6, 7, ...)');
            }

            return serviceUuid;
        };
        const getEnvironmentUuid = async (): Promise<string> => {
            if (program.environment) {
                environmentUuid = program.service;
            } else {
                environmentUuid = await CliHelper.askInteractively('Environment uuid (3)');
            }

            return environmentUuid;
        };
        const envBasedPlaybookRegexp = /(proxy)/;

        // Do something better to load playbook context
        // Then use the same logic for context injection in workflow steps
        return Promise.resolve(getPlaybookReference())
            .then(() => envBasedPlaybookRegexp.test(playbookReference) ? getEnvironmentUuid() : getServiceUuid())
            .then(() => {
                const playbookPromise = envBasedPlaybookRegexp.test(playbookReference) ?
                    app.loadPlaybook(playbookReference, environmentUuid, program.interactive) :
                    app.loadServicePlaybook(playbookReference, serviceUuid, program.interactive);
                return playbookPromise
                    .then(async (playbook: Playbook) => {
                        if (program.execute === undefined) {
                            program.execute = await CliHelper.askConfirmation('Execute playbook ?');
                        }
                        if (program.execute) {
                            await playbook.execute();
                        } else {
                            console.log('\n\n\nSUCCESS ! Playbook has been created. Use commands below to execute it manually :\n');
                            console.log(`cd ${await playbook.getDirectory()}`);
                            console.log(`ansible-playbook -i inventories/hosts root-playbook.yml`);
                            console.log(`cd ../..\n\n`);
                        }
                        app.exit();
                    });
            })
            .catch(e => {
                console.log('error (run single playbook)');
                console.log(e);
            })
            .finally(() => {
                app.exit()
            });

    } else if (program.drop) {
        const environmentUuid = program.environment;

        if (!environmentUuid) {
            console.error("You shall specify environment id");
        } else {
            app.dropEnvironment(environmentUuid).then(() => {
                app.exit();
            })
        }
    } else if (program.sequence) {
        console.log('program.sequence =', program.sequence);
        // DEPRECATED ?
        app.runSequence(parseInt(program.sequence)).then(() => {
            app.exit();
        });
    } else {
        console.log('Example commands :\n\
npm run cli -- --order=1 \n\
npm run cli -- --sequence=35 \n\
npm run cli -- --drop --environment=1 \n\
    ');
        app.exit();
    }
}).catch(err => {
    console.log('error catch end', err);
    app.exit();
    throw err;
});
