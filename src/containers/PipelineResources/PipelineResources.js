/*
Copyright 2019-2020 The Tekton Authors
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import { injectIntl } from 'react-intl';
import isEqual from 'lodash.isequal';
import keyBy from 'lodash.keyby';
import { getErrorMessage, getFilters, urls } from '@tektoncd/dashboard-utils';
import { PipelineResources as PipelineResourcesList } from '@tektoncd/dashboard-components';
import {
  InlineNotification,
  ListItem,
  Modal,
  UnorderedList
} from 'carbon-components-react';
import { Add16 as Add, Delete16 as Delete } from '@carbon/icons-react';

import { LabelFilter } from '..';
import { fetchPipelineResources } from '../../actions/pipelineResources';
import { deletePipelineResource } from '../../api';
import PipelineResourcesModal from '../PipelineResourcesModal';
import {
  getPipelineResources,
  getPipelineResourcesErrorMessage,
  getSelectedNamespace,
  isFetchingPipelineResources,
  isWebSocketConnected
} from '../../reducers';

const initialState = {
  showCreatePipelineResourceModal: false,
  createdPipelineResource: null,
  submitError: '',
  isDeleteModalOpen: false,
  toBeDeleted: []
};

export /* istanbul ignore next */ class PipelineResources extends Component {
  constructor(props) {
    super(props);

    this.handleCreatePipelineResourceSuccess = this.handleCreatePipelineResourceSuccess.bind(
      this
    );

    this.state = initialState;
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    const { filters, namespace, webSocketConnected } = this.props;
    const {
      filters: prevFilters,
      namespace: prevNamespace,
      webSocketConnected: prevWebSocketConnected
    } = prevProps;

    if (
      namespace !== prevNamespace ||
      (webSocketConnected && prevWebSocketConnected === false) ||
      !isEqual(filters, prevFilters)
    ) {
      this.fetchData();
    }
  }

  toggleModal = showCreatePipelineResourceModal => {
    this.setState({ showCreatePipelineResourceModal });
  };

  resetSuccess = () => {
    this.setState({ createdPipelineResource: false });
  };

  openDeleteModal = (selectedRows, cancelSelection) => {
    const pipelineResourcesById = keyBy(
      this.props.pipelineResources,
      'metadata.uid'
    );
    const toBeDeleted = selectedRows.map(({ id }) => pipelineResourcesById[id]);

    this.setState({ isDeleteModalOpen: true, toBeDeleted, cancelSelection });
  };

  closeDeleteModal = () => {
    this.setState({
      isDeleteModalOpen: false,
      toBeDeleted: []
    });
  };

  handleDelete = async () => {
    const { cancelSelection, toBeDeleted } = this.state;
    const deletions = toBeDeleted.map(resource =>
      this.deleteResource(resource)
    );
    this.closeDeleteModal();
    await Promise.all(deletions);
    cancelSelection();
  };

  deleteResource = pipelineResource => {
    const { name, namespace } = pipelineResource.metadata;
    return deletePipelineResource({ name, namespace }).catch(error => {
      error.response.text().then(text => {
        const statusCode = error.response.status;
        let errorMessage = `error code ${statusCode}`;
        if (text) {
          errorMessage = `${text} (error code ${statusCode})`;
        }
        this.setState({ submitError: errorMessage });
      });
    });
  };

  handleCreatePipelineResourceClick = showCreatePipelineResourceModal => {
    if (showCreatePipelineResourceModal) {
      this.setState({
        showCreatePipelineResourceModal: false
      });
    }
  };

  handleCreatePipelineResourceSuccess(newPipelineResource) {
    const {
      metadata: { namespace, name }
    } = newPipelineResource;
    const url = urls.pipelineResources.byName({
      namespace,
      pipelineResourceName: name
    });
    this.toggleModal(false);
    this.setState({ createdPipelineResource: { name, url } });
  }

  fetchData() {
    const { filters, namespace } = this.props;
    this.props.fetchPipelineResources({
      filters,
      namespace
    });
  }

  render() {
    const {
      error,
      loading,
      namespace: selectedNamespace,
      pipelineResources,
      intl
    } = this.props;

    const { isDeleteModalOpen, toBeDeleted } = this.state;

    if (error) {
      return (
        <InlineNotification
          kind="error"
          hideCloseButton
          lowContrast
          title={intl.formatMessage({
            id: 'dashboard.pipelineResources.error',
            defaultMessage: 'Error loading PipelineResources'
          })}
          subtitle={getErrorMessage(error)}
        />
      );
    }

    return (
      <>
        {this.state.createdPipelineResource && (
          <InlineNotification
            kind="success"
            title={intl.formatMessage({
              id: 'dashboard.pipelineResources.createSuccess',
              defaultMessage: 'Successfully created PipelineResource'
            })}
            subtitle={
              <Link to={this.state.createdPipelineResource.url}>
                {this.state.createdPipelineResource.name}
              </Link>
            }
            onCloseButtonClick={this.resetSuccess}
            lowContrast
          />
        )}
        {this.state.submitError && (
          <InlineNotification
            kind="error"
            title={intl.formatMessage({
              id: 'dashboard.error.title',
              defaultMessage: 'Error:'
            })}
            subtitle={getErrorMessage(this.state.submitError)}
            iconDescription={intl.formatMessage({
              id: 'dashboard.notification.clear',
              defaultMessage: 'Clear Notification'
            })}
            data-testid="errorNotificationComponent"
            onCloseButtonClick={this.props.clearNotification}
            lowContrast
          />
        )}
        <h1>PipelineResources</h1>
        <LabelFilter {...this.props} />
        <PipelineResourcesModal
          open={this.state.showCreatePipelineResourceModal}
          handleCreatePipelineResource={this.handleCreatePipelineResourceClick}
          onClose={() => this.toggleModal(false)}
          onSuccess={this.handleCreatePipelineResourceSuccess}
          pipelineRef={this.props.pipelineName}
          namespace={selectedNamespace}
        />
        <PipelineResourcesList
          batchActionButtons={[
            {
              onClick: this.openDeleteModal,
              text: intl.formatMessage({
                id: 'dashboard.actions.deleteButton',
                defaultMessage: 'Delete'
              }),
              icon: Delete
            }
          ]}
          loading={loading}
          pipelineResources={pipelineResources}
          selectedNamespace={selectedNamespace}
          toolbarButtons={[
            {
              onClick: () => this.toggleModal(true),
              text: intl.formatMessage({
                id: 'dashboard.actions.createButton',
                defaultMessage: 'Create'
              }),
              icon: Add
            }
          ]}
        />
        <Modal
          open={isDeleteModalOpen}
          primaryButtonText={intl.formatMessage({
            id: 'dashboard.actions.deleteButton',
            defaultMessage: 'Delete'
          })}
          secondaryButtonText={intl.formatMessage({
            id: 'dashboard.modal.cancelButton',
            defaultMessage: 'Cancel'
          })}
          modalHeading={intl.formatMessage({
            id: 'dashboard.pipelineResources.deleteHeading',
            defaultMessage: 'Delete PipelineResources'
          })}
          onSecondarySubmit={this.closeDeleteModal}
          onRequestSubmit={this.handleDelete}
          onRequestClose={this.closeDeleteModal}
          danger
        >
          <p>
            {intl.formatMessage({
              id: 'dashboard.pipelineResources.deleteConfirm',
              defaultMessage:
                'Are you sure you want to delete these PipelineResources?'
            })}
          </p>
          <UnorderedList nested>
            {toBeDeleted.map(pipelineResource => {
              const { name, namespace } = pipelineResource.metadata;
              return <ListItem key={`${name}:${namespace}`}>{name}</ListItem>;
            })}
          </UnorderedList>
        </Modal>
      </>
    );
  }
}

/* istanbul ignore next */
function mapStateToProps(state, props) {
  const { namespace: namespaceParam } = props.match.params;
  const namespace = namespaceParam || getSelectedNamespace(state);
  const filters = getFilters(props.location);

  return {
    error: getPipelineResourcesErrorMessage(state),
    filters,
    loading: isFetchingPipelineResources(state),
    namespace,
    pipelineResources: getPipelineResources(state, { filters, namespace }),
    webSocketConnected: isWebSocketConnected(state)
  };
}

const mapDispatchToProps = {
  fetchPipelineResources
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(injectIntl(PipelineResources));
