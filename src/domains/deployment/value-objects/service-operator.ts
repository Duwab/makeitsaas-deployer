import {
    AbstractBaseVault,
    Environment,
    Service,
    ServiceDeployment,
    ServiceSpecification
} from '@entities';
import {
    DeploymentService,
    InfrastructureService,
    VaultService
} from '@services';
import { em, _EM_, service } from '@decorators';
import { EntityManager } from 'typeorm';
import { AnsibleService, Playbook } from '@ansible';

export class ServiceOperator {
    service: Service;
    ready: Promise<any>;
    private deployment: ServiceDeployment;

    @em(_EM_.deployment)
    private em: EntityManager;

    @service
    private vaultService: VaultService;

    @service
    private deploymentService: DeploymentService;

    @service
    private infrastructureService: InfrastructureService;

    @service
    private ansibleService: AnsibleService;

    constructor(
        private environment: Environment,
        private action: string,
        private specification: ServiceSpecification|void,
        private currentComputeDeployment: ServiceDeployment|void
    ) {
        this.ready = (async () => {
            await this.initService();
            await this.initDeployment();

            if(!this.service || !this.deployment) {
                throw new Error("Could not initialize service operator properly");
            }
        })();
    }

    /*
     * ---------------
     * Public methods
     * ---------------
     */

    async allocate() {
        await this.ready;
        console.log('assigning servers and ports');

        if(!this.deployment.computingAllocation) {
            this.deployment.computingAllocation = Promise.resolve(await this.infrastructureService.allocateDevComputing());
            await this.em.save(this.deployment);
        }

        const databaseAllocation = await this.deployment.databaseAllocation;
        if(!databaseAllocation) {
            this.deployment.databaseAllocation = this.infrastructureService.allocateDevDatabase(); // TODO : pareil
            await this.em.save(this.deployment);
        }

    }

    async registerVaultValues(): Promise<any> {
        await this.ready;

        const vault = await this.vaultService.getDeploymentVault(`${this.deployment.id}`);

        let getters = this.vaultFieldsRequirementsGetters(vault);

        for(let key in getters) {
            let vaultValue = vault.getValue(key);

            if(!vaultValue) {
                const value = await getters[key].apply(this);
                console.log('vault add value', key, value);
                vault.addValue(key, value);
            } else {
                console.log('vault value already exists', vaultValue);
            }
        }

        await vault.save();
    }

    async deploy() {
        await this.ready;
        const playbookDatabase = await this.runDatabaseScript();
        const playbookCompute = await this.runComputeScript();
        console.log('deploy compute directory', await playbookCompute.getDirectory());
        await this.runMigrationsScript();
    }

    async cleanup() {
        await this.ready;
        console.log('clean me');
    }

    async dropDeployment() {
        await this.ready;
        console.log('drop me');
    }

    /*
     * ---------------
     * Private methods
     * ---------------
     */

    private async initService() {
        if(this.specification) {
            this.service = await this.deploymentService.getOrCreateService(this.specification.uuid, this.specification.repositoryUrl);
        } else if(this.currentComputeDeployment) {
            this.service = this.currentComputeDeployment.service;
        } else {
            throw new Error("Missing information : either service specification or deployment");
        }
    }

    private async initDeployment() {
        if(!this.currentComputeDeployment) {
            if(!this.specification) {
                throw new Error('Missing specifications');
            }
            this.deployment = await this.deploymentService.getOrCreateServiceDeployment(this.service, this.environment, this.specification);
        } else {
            this.deployment = this.currentComputeDeployment;
        }
    }

    private async runDatabaseScript(): Promise<Playbook|void> {
        console.log('database script');
        await this.vaultService.getDeploymentVault(`${this.deployment.id}`);
        const db = await this.deployment.databaseAllocation;
        if(db && db.status !== 'running') { // example condition, but would require a
            const playbook = await this.ansibleService.preparePlaybook('database-create', this.environment, this.deployment);
            return playbook.execute();
        }
    }

    private async runComputeScript(): Promise<Playbook> {
        console.log('compute script');
        const playbook = await this.ansibleService.preparePlaybook('computing-create', this.environment, this.deployment);
        return playbook.execute();
    }

    private async runMigrationsScript() {
        console.log('migration script');
    }

    private async runCleanupScript() {
        console.log('cleanup script');
    }

    private vaultFieldsRequirementsGetters(vault: AbstractBaseVault): {[id: string]: () => Promise<string>} {
        return {
            "DB_DATABASE": this.generateDatabaseName,
            "DB_USERNAME": this.generateDatabaseUserName,
            "DB_PASSWORD": this.passwordGenerator(),
            // "GITHUB_CLIENT_ID": this.getGithubSecret('client_id'),
            // "GITHUB_CLIENT_SECRET": this.getGithubSecret('client_secret'),
            // "GITHUB_CALLBACK_URL": this.getGithubSecret('callback_url'),
        };
    }

    private generateDatabaseName(): Promise<string> {
        console.log('this.deployment', this.deployment);
        return Promise.resolve(`db_d${this.deployment.id}`);
    }

    private generateDatabaseUserName(): Promise<string> {
        return Promise.resolve(`user_d${this.deployment.id}`);
    }

    private passwordGenerator(size: number|undefined = undefined): () => Promise<string> {
        return () => {
            return this.generatePassword(size);
        };
    }

    private generatePassword(size: number = 24): Promise<string> {
        const characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-)(+[]!?&";
        let password = "";

        for(let i = 0; i < size; i++) {
            password += characters[Math.floor(Math.random() * characters.length)];
        }

        return Promise.resolve(password);
    }
}
