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
import * as React from 'react';
import { DependencyManagementTable } from './dependencyManagementTable';

/**
 * Class: Holds properties for DependencyManagementTable.
 */
export interface IProps {
    packages: {
        [name: string]: string;
    };
    initial_packages: {
        [name: string]: string;
    };
    installed_packages: {
        [name: string]: string;
    };
    storeRow: Function;
    deleteRow: Function;
    editSavedRow: Function;
    deleteSavedRow: Function;
}


/**
 * A React Component for dependency management form.
 */
export class DependencyManagementForm extends React.Component<IProps> {
    constructor(props: IProps) {
        super(props);
    }

    render() {
        return (
            React.createElement(
                DependencyManagementTable,
                { 
                    packages: this.props.packages,
                    initial_packages: this.props.initial_packages,
                    installed_packages: this.props.installed_packages,
                    storeRow: this.props.storeRow,
                    editSavedRow: this.props.editSavedRow,
                    deleteRow: this.props.deleteRow,
                    deleteSavedRow: this.props.deleteSavedRow 
                }));
    }
}
