/**
 * Jupyterlab requirements.
 *
 * Jupyterlab extension for managing dependencies.
 *
 * @link   https://github.com/thoth-station/jupyterlab-requirements#readme
 * @file   Jupyterlab extension for managing dependencies.
 * @author Francesco Murdaca <fmurdaca@redhat.com>
 * @since  0.0.1
 */

import _ from "lodash";

import * as React from 'react';

import { NotebookPanel } from '@jupyterlab/notebook';

import { DependencyManagementForm } from './dependencyManagementForm'
import { DependencyManagementSaveButton } from './dependencyManagementSaveButton'
import { DependencyManagementInstallButton } from './dependencyManagementInstallButton'
import { DependencyManagementNewPackageButton } from './dependencyManagementAddPackageButton';

import { get_python_version } from "../notebook";
import { Source, Requirements, RequirementsLock } from '../types/requirements';

import { RuntimeEnvornment, ThothConfig } from '../types/thoth';

import {
  discover_installed_packages,
  store_dependencies,
  install_packages,
  create_new_kernel
} from '../kernel';

import {
  retrieve_config_file,
  lock_requirements_with_thoth,
  lock_requirements_with_pipenv
} from '../thoth';

import {
  get_kernel_name,
  set_requirements,
  set_requirement_lock,
  set_thoth_configuration
} from "../notebook"

import { Advise } from "../types/thoth";

/**
 * The class name added to the new package button (CSS).
 */
const OK_BUTTON_CLASS = "thoth-ok-button";
const THOTH_KERNEL_NAME_INPUT = "thoth-kernel-name-input";
const CONTAINER_BUTTON = "thoth-container-button";
const CONTAINER_BUTTON_CENTRE = "thoth-container-button-centre";

/**
 * Class: Holds properties for DependenciesManagementDialog.
 */

interface IProps {
  panel: NotebookPanel,
  initial_requirements: Requirements,
  initial_requirements_lock: RequirementsLock,
  initial_config_file: ThothConfig
}

/**
 * Class: Holds state for DependenciesManagementDialog.
 */

export interface IState {
  kernel_name: string
  recommendation_type: string
  status: string,
  packages: { [ name: string ]: string },
  installed_packages: { [ name: string ]: string },
  initial_packages: { [ name: string ]: string },
  requirements: Requirements,
  error_msg: string
}

/**
 * A React Component for handling dependency management.
 */

export class DependenciesManagementUI extends React.Component<IProps, IState> {
    constructor(props: IProps) {
      super(props);

      this.onStart = this.onStart.bind(this),
      this.changeUIstate = this.changeUIstate.bind(this),
      this.addNewRow = this.addNewRow.bind(this),
      this.editRow = this.editRow.bind(this),
      this.editSavedRow = this.editSavedRow.bind(this),
      this.storeRow = this.storeRow.bind(this),
      this.deleteRow = this.deleteRow.bind(this),
      this.deleteSavedRow = this.deleteSavedRow.bind(this),
      this.onSave = this.onSave.bind(this),
      this.checkInstalledPackages = this.checkInstalledPackages.bind(this),
      this.lock_using_thoth = this.lock_using_thoth.bind(this),
      this.lock_using_pipenv = this.lock_using_pipenv.bind(this),
      this.install = this.install.bind(this),
      this.setKernel = this.setKernel.bind(this),
      this.createConfig = this.createConfig.bind(this),
      this.setKernelName = this.setKernelName.bind(this)
      this.setRecommendationType = this.setRecommendationType.bind(this)

      this.state = {
        kernel_name: "jupyterlab_requirements",
        recommendation_type: "latest",
        status: "loading",
        packages: {},  // editing
        initial_packages: {},
        installed_packages: {},
        requirements: {
          packages: {},
          requires: { python_version: get_python_version( this.props.panel ) },
          sources: [new Source()]
        },
        error_msg: undefined
      }
    }

    /**
     * Function: Main function to change state and status!
     */

    changeUIstate(
      status: string,
      packages: { [ name: string ]: string },
      initial_packages: { [ name: string ]: string },
      installed_packages: { [ name: string ]: string },
      requirements: Requirements,
      kernel_name: string,
      error_msg?: string,
    ) {

      var new_state: IState = this.state
      console.log("initial", new_state)

      _.set(new_state, "status", status)

      _.set(new_state, "packages", packages)

      _.set(new_state, "initial_packages", initial_packages)

      _.set(new_state, "installed_packages", installed_packages)

      _.set(new_state, "requirements", requirements)

      _.set(new_state, "kernel_name", kernel_name)

      _.set(new_state, "error_msg", error_msg)

      console.log("new", new_state)
      this.setState(new_state);
    }

    /**
     * Function: Set recommendation type for thamos advise
     */

    setRecommendationType(recommendation_type: string) {

      this.setState(
        {
          recommendation_type: recommendation_type
        }
      );

    }

    changeRecommendationType(event: React .ChangeEvent<HTMLInputElement>) {

        const recommendation_type = event.target.value;
        this.setRecommendationType( recommendation_type )
  }

    /**
     * Function: Set Kernel name to be created and assigned to notebook
     */

    setKernelName(event: React.ChangeEvent<HTMLInputElement>) {

      const kernel_name = event.target.value

      this.setState(
        {
          kernel_name: kernel_name
        }
      );

    }

    /**
     * Function: Add new empty row (Only one can be added at the time)
     */

    addNewRow() {

      const packages = this.state.packages

      _.set(packages, "", "")
      console.log("added package", packages)

      this.changeUIstate(
        "editing",
        packages,
        this.state.initial_packages,
        this.state.installed_packages,
        this.state.requirements,
        this.state.kernel_name
      )
    }

    /**
     * Function: Edit added row
     */

    editRow(package_name: string) {

      const packages = this.state.packages

      _.unset(packages, package_name)
      _.set(packages, "", "*")

      console.log("After editing (current)", packages)

      this.changeUIstate(
        "editing",
        packages,
        this.state.initial_packages,
        this.state.installed_packages,
        this.state.requirements,
        this.state.kernel_name
      )

    }

    /**
     * Function: Edit saved row
     */

    editSavedRow(package_name: string, package_version: string) {

      const initial_packages = this.state.initial_packages
      const packages = this.state.packages

      _.unset(initial_packages, package_name)
      _.set(packages, package_name, package_version)

      console.log("After editing (initial)", initial_packages)
      console.log("After editing (current)", packages)

      this.changeUIstate(
        "editing",
        packages,
        initial_packages,
        this.state.installed_packages,
        this.state.requirements,
        this.state.kernel_name
      )

    }

    /**
     * Function: Delete row not saved
     */

    deleteRow(package_name: string) {

      const packages = this.state.packages

      _.unset(packages, package_name)

      console.log("After deleting", packages)

      this.changeUIstate(
        "editing",
        packages,
        this.state.initial_packages,
        this.state.installed_packages,
        this.state.requirements,
        this.state.kernel_name
      )

    }

    /**
     * Function: Delete row saved
     */

    deleteSavedRow(package_name: string) {

      const saved_packages = this.state.initial_packages

      _.unset(saved_packages, package_name)

      console.log("After deleting saved", saved_packages)

      this.changeUIstate(
        "editing",
        this.state.packages,
        saved_packages,
        this.state.installed_packages,
        this.state.requirements,
        this.state.kernel_name
      )
    }

    /**
     * Function: Store row when user requests it
     */

    storeRow(package_name: string, package_version: string) {

      let packages = this.state.packages

      _.set(packages, package_name, package_version)
      const new_dict: { [ name: string ]: string } = {}

      _.forIn(packages, function(value, key) {
        console.log(key + ' goes ' + value);

        if ( key != "" ) {
          _.set(new_dict, key, value)
        }
      })

      console.log("new packages", new_dict)

      this.changeUIstate(
        "editing",
        new_dict,
        this.state.initial_packages,
        this.state.installed_packages,
        this.state.requirements,
        this.state.kernel_name
      )

    }

    /**
     * Function: Save button to store every input in notebook
     */

    onSave() {

      const notebookMetadataRequirements = this.state.requirements
      const added_packages = this.state.packages
      console.log("added_packages", added_packages)
      const initial_packages = this.state.initial_packages
      console.log("initial_packages", initial_packages)

      // Evaluate total package from initial + added
      const total_packages = {}

      _.forIn(initial_packages, function(value, key) {
        if (_.has(initial_packages, "") == false) {
          _.set(total_packages, key, value)
        }
      })

      const new_packages = {}
      _.forIn(added_packages, function(value, key) {
        if (_.has(added_packages, "") == false) {
          _.set(total_packages, key, value)
          _.set(new_packages, key, value)
        }
      })

      // Check if there are packages saved, otherwise go to failed notification message
      if ( _.size(total_packages ) > 0 ) {

        if ( _.isEqual(total_packages, this.state.installed_packages) ){

          var sameRequirements: Requirements = {
            packages: total_packages,
            requires: notebookMetadataRequirements.requires,
            sources: notebookMetadataRequirements.sources
          }

          // Set requirements in notebook;
          set_requirements( this.props.panel , sameRequirements )

          // Save all changes to disk.
          this.props.panel.context.save()

          this.changeUIstate(
            "stable",
            {},
            this.state.initial_packages,
            this.state.installed_packages,
            this.state.requirements,
            this.state.kernel_name
          )
          return

        }

        else {

          console.log("total packages", total_packages)

          var finalRequirements: Requirements = {
            packages: total_packages,
            requires: notebookMetadataRequirements.requires,
            sources: notebookMetadataRequirements.sources
          }

          console.log("Requirements before installing are: ", finalRequirements)

          // Set requirements in notebook;
          set_requirements( this.props.panel , finalRequirements )

          // Save all changes to disk.
          this.props.panel.context.save()

          this.changeUIstate(
            "saved",
            {},
            total_packages,
            this.state.installed_packages,
            finalRequirements,
            this.state.kernel_name
          )

          return
        }

      }
      else {

        var emptyRequirements: Requirements = {
          packages: total_packages,
          requires: notebookMetadataRequirements.requires,
          sources: notebookMetadataRequirements.sources
        }

        console.log("Requirements are: ", emptyRequirements)

        // Set requirements in notebook;
        set_requirements( this.props.panel , emptyRequirements )

        this.changeUIstate(
          "failed_no_reqs",
          new_packages,
          this.state.initial_packages,
          this.state.installed_packages,
          this.state.requirements,
          this.state.kernel_name
        )
        return
      }
    }

    async install() {

      try {
          // Create new virtual environment and install dependencies using selected dependency manager (micropipenv by default)
          const install_message = await install_packages( this.state.kernel_name );
          console.log("Install message", install_message);

          this.changeUIstate(
            "setting_kernel",
            {},
            this.state.initial_packages,
            this.state.initial_packages,
            this.state.requirements,
            this.state.kernel_name
          )

          return

      } catch ( error ) {

        console.log("Error installing requirements", error)

        this.changeUIstate(
          "failed",
          this.state.packages,
          this.state.initial_packages,
          this.state.installed_packages,
          this.state.requirements,
          this.state.kernel_name,
          "Error install dependencies in the new virtual environment, please contact Thoth team."
        )
      }

    }

    async store_dependencies_on_disk (requirements: Requirements, requirements_lock: RequirementsLock) {
        // TODO: Requested from the user (in this case it is to install them)
        const store_message: string = await store_dependencies(
          this.state.kernel_name,
          JSON.stringify(requirements),
          JSON.stringify(requirements_lock)
        );

        console.log("Store message", store_message);
    }

    async setKernel() {

      try {
          // Add new virtualenv to jupyter kernel so that it can be assigned to notebook.
          const message = await create_new_kernel( this.state.kernel_name );
          console.log("Kernel message", message);

          this.changeUIstate(
            "ready",
            {},
            this.state.initial_packages,
            this.state.initial_packages,
            this.state.requirements,
            this.state.kernel_name
          )

          return

        } catch ( error ) {

          console.log("Error creating jupyter kernel", error)

          this.changeUIstate(
            "failed",
            this.state.packages,
            this.state.initial_packages,
            this.state.installed_packages,
            this.state.requirements,
            this.state.kernel_name,
            "Error setting new environment in a jupyter kernel, please contact Thoth team."
          )

          return

        }
    }

    async lock_using_thoth() {

      this.changeUIstate(
        "locking_requirements",
        this.state.packages,
        this.state.initial_packages,
        this.state.installed_packages,
        this.state.requirements,
        this.state.kernel_name
      )

      const thothConfig: ThothConfig = await this.createConfig();

      const runtime_environments: RuntimeEnvornment[] = thothConfig.runtime_environments

      const runtime_environment: RuntimeEnvornment = runtime_environments[0]

      // TODO: Assign user recommendation type to all runtime environments in thoth config?
      _.set(runtime_environment, "recommendation_type", this.state.recommendation_type)
      _.set(runtime_environments, 0, runtime_environment)
      _.set(thothConfig, "runtime_environments", runtime_environments)

      console.log("thoth config submitted", JSON.stringify(thothConfig));

      const notebookMetadataRequirements = this.state.requirements;
      console.log("Requirements submitted", JSON.stringify(notebookMetadataRequirements));

      try {

        const advise: Advise = await lock_requirements_with_thoth(
          this.state.kernel_name,
          JSON.stringify(thothConfig),
          JSON.stringify(notebookMetadataRequirements)
        );
        console.log("Advise received", advise);

        if ( advise.error == false ) {
          // Set requirements in notebook;
          set_requirements( this.props.panel , advise.requirements )
          set_requirement_lock( this.props.panel , advise.requirement_lock )
          set_thoth_configuration( this.props.panel , thothConfig )

          this.changeUIstate(
            "installing_requirements",
            {},
            this.state.initial_packages,
            this.state.installed_packages,
            advise.requirements,
            this.state.kernel_name
          )

        }
        else {

          this.lock_using_pipenv()
        }

      } catch ( error ) {

        console.log("Error locking requirements with Thoth", error)

        this.lock_using_pipenv()
      }

    }

    async lock_using_pipenv () {

      this.changeUIstate(
        "locking_requirements_using_pipenv",
        this.state.packages,
        this.state.initial_packages,
        this.state.installed_packages,
        this.state.requirements,
        this.state.kernel_name
      )

      const notebookMetadataRequirements = this.state.requirements;
      console.log("Requirements for pipenv", JSON.stringify(notebookMetadataRequirements));

      try {

        // TODO: Add check to avoid relocking if dependencies are already locked.
        const result = await lock_requirements_with_pipenv(
          this.state.kernel_name,
          JSON.stringify(notebookMetadataRequirements)
        )
        console.log("Result received", result);

        if ( result.error == false ) {

          set_requirement_lock( this.props.panel , result.requirements_lock )

          this.changeUIstate(
            "installing_requirements",
            {},
            this.state.initial_packages,
            this.state.installed_packages,
            notebookMetadataRequirements,
            this.state.kernel_name
          )

          return
        }

        else {

          this.changeUIstate(
            "failed",
            this.state.packages,
            this.state.initial_packages,
            this.state.installed_packages,
            this.state.requirements,
            this.state.kernel_name,
            "No resolution engine was able to install dependendices, please contact Thoth team."
          )

          return
        }

      } catch ( error ) {

        console.log("Error locking requirements with pipenv", error)

        this.changeUIstate(
          "failed",
          this.state.packages,
          this.state.initial_packages,
          this.state.installed_packages,
          this.state.requirements,
          this.state.kernel_name,
          "No resolution engine was able to install dependendices, please contact Thoth team."
        )
        return

      }
    }

    async onStart() {

        // Load requirements from notebook metadata if any otherwise receive default one
        var initial_requirements: Requirements = this.props.initial_requirements
        console.log("initial requirements", initial_requirements)
        var initial_packages = initial_requirements.packages

        // Check if any package is present in the loaded requirements otherwise go to initial state
        if ( _.size( initial_packages ) == 0 ) {
          this.changeUIstate(
            status="initial" ,
            this.state.packages,
            initial_packages,
            this.state.installed_packages,
            initial_requirements,
            this.state.kernel_name
          )
          return
        }

        // requirements is present in notebook metadata

        // Load requirements lock from notebook metadata ( if any )
        const initial_requirements_lock = this.props.initial_requirements_lock

        // Check if requirements locked are present
        if ( initial_requirements_lock == null ) {
          this.changeUIstate(
            status="only_install" ,
            this.state.packages,
            initial_packages,
            this.state.installed_packages,
            initial_requirements,
            this.state.kernel_name
          )
          return
        }

        const initial_locked_packages = {}
        // requirements and requirements locked are present in notebook metadata

        // Retrieve packages locked
        _.forIn(initial_requirements_lock.default, function(value, package_name) {
          _.set(initial_locked_packages, package_name, value.version.replace("==", ""))
        })
        console.log(initial_locked_packages)

        // Retrieve kernel name from metadata
        const kernel_name = get_kernel_name( this.props.panel)

        // Check if all package in requirements are also in requirements locked (both from notebook metadata)
        const check_packages = {}

        _.forIn(initial_packages, function(version, name) {
          if (_.has(initial_locked_packages, name.toLowerCase())) {
            _.set(check_packages, name, version)
          }
        })

        console.log("initial packages", initial_packages)
        console.log("packages in req and req lock", check_packages)

        const installed_packages = await this.retrieveInstalledPackages(kernel_name, initial_locked_packages)

        const initial_installed_packages = {}

        _.forIn(initial_packages, function(version, name) {
          if (_.has(installed_packages, name.toLowerCase())) {
            _.set(initial_installed_packages, name, version)
          }
        })

        console.log("initial installed packages", initial_installed_packages)

        if (_.isEqual(_.size(initial_packages), _.size(check_packages) )) {


          // check if all requirements locked are also installed in the current kernel
          const are_installed: boolean = await this.checkInstalledPackages(installed_packages, initial_locked_packages)

          // if locked requirements are present in the kernel (match packages installed), go to stable state
          if ( are_installed == true ) {

            this.changeUIstate(
              "stable",
              this.state.packages,
              initial_packages,
              initial_packages,
              initial_requirements,
              kernel_name
              )

            return
          }

          // if locked requirements are not present or not all present in the kernel, go to only_install state
          else {
            this.changeUIstate(
              "only_install_kernel",
              this.state.packages,
              initial_packages,
              initial_installed_packages,
              initial_requirements,
              kernel_name
              )
            return
          }
        }

        else {
          this.changeUIstate(
            "only_install_kernel",
            this.state.packages,
            initial_packages,
            initial_installed_packages,
            initial_requirements,
            kernel_name
            )
          return
        }
    }


    async retrieveInstalledPackages(kernel_name:string, packages: {}): Promise<{}> {

      // Retrieve installed packages
      const retrieved_packages = await discover_installed_packages( kernel_name )

      console.log("packages installed (pip list)", retrieved_packages);
      const installed_packages = {}

      _.forIn(retrieved_packages, function(version, name) {
        if (_.has(packages, name.toLowerCase())) {
          if ( _.get(packages, name.toLowerCase()) == version) {
            _.set(installed_packages, name, version)
          }
        }
      })
      console.log("Installed packages:", installed_packages)

      return installed_packages
    }

    async checkInstalledPackages(installed_packages: {}, packages: {}): Promise<boolean> {

      // Check installed packages
      if (_.isEqual(_.size(packages), _.size(installed_packages) )) {
        return true
      }

      else {
        return false
      }

    }

    async createConfig() {
      // TODO: Use config created automatically by thamos??
      const config_file = await retrieve_config_file( this.state.kernel_name);
      console.log("Config file", config_file);

      return config_file
    }

    render(): React.ReactNode {

      let dependencyManagementform = <div>
                                        <DependencyManagementForm
                                          initial_packages={this.state.initial_packages}
                                          installed_packages={this.state.installed_packages}
                                          packages={this.state.packages}
                                          editRow={this.editRow}
                                          storeRow={this.storeRow}
                                          deleteRow={this.deleteRow}
                                          editSavedRow={this.editSavedRow}
                                          deleteSavedRow={this.deleteSavedRow}
                                        />
                                      </div>

      let addPlusInstallContainers = <div>
                                        <div className={CONTAINER_BUTTON}>
                                          <div className={CONTAINER_BUTTON_CENTRE}>
                                          <DependencyManagementNewPackageButton addNewRow={this.addNewRow} />
                                          </div>
                                        </div>
                                        <div className={CONTAINER_BUTTON}>
                                          <div className={CONTAINER_BUTTON_CENTRE}>
                                            <DependencyManagementInstallButton
                                            changeUIstate={this.changeUIstate}
                                            install={this.lock_using_thoth} />
                                          </div>
                                        </div>
                                      </div>

      let addPlusSaveContainers = <div>
                                      <div className={CONTAINER_BUTTON}>
                                        <div className={CONTAINER_BUTTON_CENTRE}>
                                        <DependencyManagementNewPackageButton addNewRow={this.addNewRow} />
                                        </div>
                                      </div>
                                      <div className={CONTAINER_BUTTON}>
                                        <div className={CONTAINER_BUTTON_CENTRE}>
                                          <DependencyManagementSaveButton
                                            onSave={this.onSave}
                                            changeUIstate={this.changeUIstate} />
                                        </div>
                                      </div>
                                    </div>

    let optionsForm = <div>
                        <section>
                          <h2>OPTIONS</h2>
                        </section>

                        <form>
                          <label>
                            Kernel name:
                            <input
                              title="Kernel name"
                              type="text"
                              name="kernel_name"
                              value={this.state.kernel_name}
                              onChange={this.setKernelName}
                            />
                          </label>
                          <br />
                          <label>
                            Recommendation type:
                            <select onChange={() => this.changeRecommendationType}>
                              title="Recommendation Type"
                              name="recommendation_type"
                              value={this.state.recommendation_type}
                              <option value="latest">latest</option>
                              <option value="performance">performance</option>
                              <option value="security">security</option>
                              <option value="stable">stable</option>
                            </select>
                          </label>
                          </form>
                      </div>

      if ( this.state.status == "loading" ) {

        this.onStart( )

        return (
          <div>
          Loading...
          </div>
        )

      }

      if ( this.state.status == "initial" ) {

        return (
          <div>
            <div className={CONTAINER_BUTTON}>
              <div className={CONTAINER_BUTTON_CENTRE}>
              <DependencyManagementNewPackageButton addNewRow={this.addNewRow} />
              </div>
            </div>
            <div>
              <fieldset>
                <p> No dependencies found! Click New to add package. </p>
              </fieldset>
            </div>

          </div>
        );
      }

      if ( this.state.status == "no_reqs_to_save" ) {

        return (
          <div>
              {dependencyManagementform}
              {addPlusSaveContainers}
            <div>
              <fieldset>
                <p> Dependencies missing! Click New to add package. </p>
              </fieldset>
            </div>
          </div>
        );
      }

      if ( this.state.status == "only_install" ) {

        return (
          <div>
            {dependencyManagementform}
            {addPlusInstallContainers}

            <div>
              <fieldset>
                <p>Dependencies found in notebook metadata but lock file is missing. </p>
              </fieldset>
            </div>

            {optionsForm}
          </div>
        );
      }


      if ( this.state.status == "only_install_kernel" ) {

        return (
          <div>
            {dependencyManagementform}
            {addPlusInstallContainers}
            <div>
              <fieldset>
                <p>Pinned down software stack found in notebook metadata!<br></br>
                The kernel selected does not match the dependencies found for the notebook. <br></br>
                Please install them.</p>
              </fieldset>
            </div>
            {optionsForm}
          </div>
        );
      }

      if ( this.state.status == "editing" ) {
        return (
          <div>
            {dependencyManagementform}
            {addPlusSaveContainers}
          </div>
        );
      }

      if ( this.state.status == "saved" ) {
        return (
          <div>
            {dependencyManagementform}
            {addPlusInstallContainers}

            OPTIONS
            <div> Kernel name
              <input title="Kernel name"
                className={THOTH_KERNEL_NAME_INPUT}
                type="text"
                name="kernel_name"
                value={this.state.kernel_name}
                onChange={this.setKernelName}
              />
            </div>
          </div>
        );
      }

      if ( this.state.status == "locking_requirements" ) {
        return (
          <div>
            {dependencyManagementform}
            <fieldset>
              <p>Contacting thoth for advise... please be patient!</p>
            </fieldset>
          </div>
        );
      }

      if ( this.state.status == "installing_requirements" ) {

        this.install()

        return (
          <div>
            {dependencyManagementform}
            <fieldset>
              <p>Requirements locked and saved!<br></br>
              Installing new requirements...
              </p>
            </fieldset>
          </div>
        );
      }

      if ( this.state.status == "setting_kernel" ) {

        this.setKernel()

        return (
          <div>
            {dependencyManagementform}
            <fieldset>
              <p>Requirements locked and saved!<br></br>
              Requirements installed!<br></br>
              Setting new kernel for your notebook...
              </p>
            </fieldset>
          </div>
        );

      }

      if ( this.state.status == "failed_no_reqs" ) {

        return (
          <div>
            <div>
              <button
                title='Add requirements.'
                className={OK_BUTTON_CLASS}
                onClick={() => this.changeUIstate(
                  "loading",
                  this.state.packages,
                  this.state.initial_packages,
                  this.state.installed_packages,
                  this.state.requirements,
                  this.state.kernel_name
                )
                }
                >
                Ok
              </button>
            </div>
            <div>
              <fieldset>
                <p>No requirements have been added please click add after inserting package name!</p>
              </fieldset>
            </div>
          </div>
      );

    }

      if ( this.state.status == "locking_requirements_using_pipenv" ) {

        return (
          <div>
            <fieldset>
              <p>Thoth resolution engine failed... pipenv will be used to lock and install dependencies!</p>
            </fieldset>
          </div>
      );

      }

      if ( this.state.status == "failed" ) {

        return (
          <div>
            {dependencyManagementform}
            <div>
              <div className={CONTAINER_BUTTON}>
                <div className={CONTAINER_BUTTON_CENTRE}>
                  <button
                    title='Finish.'
                    className={OK_BUTTON_CLASS}
                    onClick={() => this.changeUIstate(
                      "loading",
                      this.state.packages,
                      this.state.initial_packages,
                      this.state.installed_packages,
                      this.state.requirements,
                      this.state.kernel_name
                    )
                    }
                    >
                    Ok
                  </button>
                </div>
              </div>
            </div>
            <div>
              <p>{this.state.error_msg}</p>
            </div>
          </div>
      );

      }

      if ( this.state.status == "stable" ) {

        return (
          <div>
            {dependencyManagementform}
            <div className={CONTAINER_BUTTON}>
              <div className={CONTAINER_BUTTON_CENTRE}>
              <DependencyManagementNewPackageButton addNewRow={this.addNewRow} />
              </div>
            </div>
            <div>
              <fieldset>
                <p> Everything installed and ready to use!</p>
              </fieldset>
            </div>
          </div>
        );
      }

      if ( this.state.status == "ready" )

        this.props.panel.sessionContext.session.changeKernel({"name": this.state.kernel_name})

        return (
          <div>
            {dependencyManagementform}
            <div>
              <div className={CONTAINER_BUTTON}>
                  <div className={CONTAINER_BUTTON_CENTRE}>
                    <button
                      title='Reload Page and assign kernel.'
                      className={OK_BUTTON_CLASS}
                      onClick={() => this.changeUIstate(
                        "stable",
                        this.state.packages,
                        this.state.initial_packages,
                        this.state.installed_packages,
                        this.state.requirements,
                        this.state.kernel_name
                      )
                      }
                      >
                      Ok
                    </button>
                  </div>
              </div>
            </div>
            <div>
                <fieldset>
                  <p>Requirements locked and saved!<br></br>
                  Requirements installed!<br></br>
                  New kernel created!<br></br>
                  Click ok to start working on your notebook.<br></br>
                  </p>
                </fieldset>
            </div>
          </div>
      );

    }
}
