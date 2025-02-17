import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Form } from '.';
import { NgForm } from '../nginputs/form';
import debounce from 'lodash/debounce';
import { createTooltip } from '../../tooltips';
import ReactTable from 'react-table';
import { NgSelectRenderer } from '../nginputs';
import _ from 'lodash';

function urlTo(url) {
  window.history.replaceState({}, '', url);
}

function LoadingComponent(props) {
  return (
    <div
      className="loadingPage"
      style={{
        display:
          props.loading && props.loadingText && props.loadingText.trim().length > 0
            ? 'flex'
            : 'none',
      }}
    >
      {props.loadingText}
    </div>
  );
}

export class Table extends Component {
  static propTypes = {
    itemName: PropTypes.string.isRequired,
    columns: PropTypes.array.isRequired,
    fetchItems: PropTypes.func.isRequired,
    updateItem: PropTypes.func,
    deleteItem: PropTypes.func,
    createItem: PropTypes.func,
    navigateTo: PropTypes.func,
    stayAfterSave: PropTypes.bool.isRequired,
    showActions: PropTypes.bool.isRequired,
    showLink: PropTypes.bool.isRequired,
    formSchema: PropTypes.object,
    formFlow: PropTypes.array,
    extractKey: PropTypes.func.isRequired,
    defaultValue: PropTypes.func,
    rowNavigation: PropTypes.bool.isRequired,
  };

  static defaultProps = {
    rowNavigation: false,
    stayAfterSave: false,
    pageSize: 15,
  };

  state = {
    items: [],
    pages: 1,
    showAddForm: false,
    showEditForm: false,
    loading: false,
    hasError: false,
    rowsPerPage: this.props.pageSize || 15,
    page: 0,
  };

  tableRef = React.createRef();

  componentDidMount() {
    this.registerSizeChanges();

    this.setPlaceholders();

    if (this.props.injectTable) {
      this.props.injectTable(this);
    }
    this.readRoute();
  }

  registerSizeChanges = () => {
    this.sizeListener = debounce((e) => {
      this.forceUpdate();
      this.setPlaceholders();
    }, 400);
    window.addEventListener('resize', this.sizeListener);
  };

  componentWillUnmount() {
    window.removeEventListener('resize', this.sizeListener);
    this.unmountShortcuts();
  }

  componentDidCatch(err, info) {
    this.setState({ hasError: true });
    console.log('Table has error', err, info);
  }

  setPlaceholders = () => {
    [...document.querySelectorAll('.rt-table input[type=text]')].map((r) =>
      r.setAttribute('placeholder', 'Search ...')
    );
  };

  readRoute = () => {
    if (this.props.parentProps.params.taction) {
      const action = this.props.parentProps.params.taction;
      if (action === 'add') {
        this.showAddForm();
      } else if (action === 'edit') {
        const item = this.props.parentProps.params.titem;
        this.props.fetchItems().then((res) => {
          //console.log(this.props.parentProps.params);
          // console.log(res)
          // console.log('here')

          let row = [];
          if (typeof res === 'object' && res !== null && !Array.isArray(res) && res.data)
            row = res.data.filter((d) => this.props.extractKey(d) === item)[0];
          else row = res.filter((d) => this.props.extractKey(d) === item)[0];
          this.showEditForm(null, row);
        });
      }
    }
  };

  mountShortcuts = () => {
    document.body.addEventListener('keydown', this.saveShortcut);
  };

  unmountShortcuts = () => {
    document.body.removeEventListener('keydown', this.saveShortcut);
  };

  saveShortcut = (e) => {
    if (e.keyCode === 83 && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (this.state.showEditForm) {
        this.updateItem();
      }
      if (this.state.showAddForm) {
        this.createItem();
      }
    }
  };

  update = debounce((paginationState = {}) => {
    this.setState({ loading: true });

    const page = paginationState.page !== undefined ? paginationState.page : this.state.page;
    return (
      this.state.showAddForm || this.state.showEditForm
        ? this.props.fetchItems()
        : this.props.fetchItems({
            ...paginationState,
            pageSize: this.state.rowsPerPage,
            page: page + 1,
          })
    ).then((rawItems) => {
      if (Array.isArray(rawItems)) {
        this.setState({
          items: rawItems,
          loading: false,
          page,
        });
      } else {
        this.setState({
          items: rawItems.data,
          pages: rawItems.pages,
          loading: false,
          page,
        });
      }
    });
  }, 200);

  gotoItem = (e, item) => {
    if (e && e.preventDefault) e.preventDefault();
    this.props.navigateTo(item);
  };

  closeAddForm = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    this.unmountShortcuts();
    if (this.props.parentProps.setTitle) {
      this.props.parentProps.setTitle(
        this.props.defaultTitle,
        this.updateItemAndStay,
        this.state.currentItem
      );
    }
    this.setState({ currentItem: null, showAddForm: false });
    this.update();
    urlTo(`/bo/dashboard/${this.props.selfUrl}`);
  };

  showAddForm = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    this.mountShortcuts();

    urlTo(`/bo/dashboard/${this.props.selfUrl}/add`);
    const defVal = this.props.defaultValue();

    if (this.props.parentProps.setTitle) {
      this.props.parentProps.setTitle(
        `Create a new ${this.props.itemName}`,
        this.updateItemAndStay,
        defVal
      );
    }

    if (defVal.then) {
      defVal.then((v) => this.setState({ currentItem: v, showAddForm: true }));
    } else {
      this.setState({ currentItem: defVal, showAddForm: true });
    }
  };

  closeEditForm = (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    this.unmountShortcuts();

    if (this.props.navigateTo) {
      this.props.parentProps.history.replace(`/${this.props.selfUrl}`);
    } else {
      if (this.props.parentProps.setTitle) {
        this.props.parentProps.setTitle(this.props.defaultTitle);
      }

      this.setState({ currentItem: null, showEditForm: false });
      this.update();
      urlTo(`/bo/dashboard/${this.props.selfUrl}`);
    }
  };

  showEditForm = (e, item) => {
    if (e && e.preventDefault) e.preventDefault();
    this.mountShortcuts();

    let routeTo = `/bo/dashboard/${this.props.selfUrl}/edit/${this.props.extractKey(item)}`;

    if (this.props.rawEditUrl) {
      routeTo = `/bo/dashboard/${this.props.selfUrl}/${this.props.extractKey(item)}`;
    }

    // console.log(window.location.pathname, routeTo);
    if (window.location.pathname !== routeTo) {
      window.location.href = routeTo;
    } else {
      if (this.props.parentProps.setTitle) {
        this.props.parentProps.setTitle(
          `Update a ${this.props.itemName}`,
          this.updateItemAndStay,
          item
        );
      }
      this.setState({ currentItem: item, showEditForm: true });
    }
  };

  deleteItem = (e, item) => {
    if (e && e.preventDefault) e.preventDefault();
    console.log();
    window.newConfirm('Are you sure you want to delete that item ?').then((ok) => {
      if (ok) {
        this.props
          .deleteItem(item)
          .then(() => {
            const state = this.tableRef?.current?.state || {};
            const page = state.page || 0;

            return this.props.fetchItems({
              filtered: state.filtered,
              sorted: state.sorted,
              pageSize: this.state.rowsPerPage,
              page: page + 1,
            });
          })
          .then((res) => {
            const isPaginate =
              typeof res === 'object' && res !== null && !Array.isArray(res) && res.data;
            urlTo(`/bo/dashboard/${this.props.selfUrl}`);
            this.setState({
              items: isPaginate ? res.data : res,
              showEditForm: false,
              showAddForm: false,
            });
          });
      }
    });
  };

  createItem = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    this.props
      .createItem(this.state.currentItem)
      .then(() => {
        return this.props.fetchItems();
      })
      .then((res) => {
        const isPaginate =
          typeof res === 'object' && res !== null && !Array.isArray(res) && res.data;
        urlTo(`/bo/dashboard/${this.props.selfUrl}`);
        this.setState({ items: isPaginate ? res.data : res, showAddForm: false });
      });
  };

  createItemAndStay = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    this.props.createItem(this.state.currentItem).then(() => {
      urlTo(
        `/bo/dashboard/${this.props.selfUrl}/edit/${this.props.extractKey(this.state.currentItem)}`
      );
      this.setState({ showAddForm: false, showEditForm: true });
    });
  };

  updateItem = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    this.props
      .updateItem(this.state.currentItem)
      .then(() => {
        return this.props.fetchItems();
      })
      .then((res) => {
        const isPaginate =
          typeof res === 'object' && res !== null && !Array.isArray(res) && res.data;
        this.setState({ items: isPaginate ? res.data : res, showEditForm: false });
      });
  };

  updateItemAndStay = (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    return this.props.updateItem(this.state.currentItem);
  };

  exportJson = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const name = (this.state.currentItem.name || this.state.currentItem.clientName)
      .replace(/ /g, '-')
      .replace(/\(/g, '')
      .replace(/\)/g, '')
      .replace(/\./g, '')
      .toLowerCase();
    const itemName = this.props.itemName
      .replace(/ /g, '-')
      .replace(/\(/g, '')
      .replace(/\)/g, '')
      .replace(/\./g, '')
      .toLowerCase();
    const json = JSON.stringify(
      { ...this.state.currentItem, kind: this.props.kubernetesKind },
      null,
      2
    );
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.id = String(Date.now());
    a.style.display = 'none';
    a.download = `${itemName}-${name}-${Date.now()}.json`;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 300);
  };

  isAnObject = (variable) =>
    typeof variable === 'object' && !Array.isArray(variable) && variable !== null;

  actualFlow = () => {
    if (_.isFunction(this.props.formFlow)) {
      return this.props.formFlow(this.state.currentItem);
    } else {
      return this.props.formFlow;
    }
  };

  exportYaml = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const name = (this.state.currentItem.name || this.state.currentItem.clientName)
      .replace(/ /g, '-')
      .replace(/\(/g, '')
      .replace(/\)/g, '')
      .toLowerCase();
    const itemName = this.props.itemName
      .replace(/ /g, '-')
      .replace(/\(/g, '')
      .replace(/\)/g, '')
      .toLowerCase();
    /*
    // const json = YAML.stringify({
      apiVersion: 'proxy.otoroshi.io/v1',
      kind: this.props.kubernetesKind,
      metadata: {
        name,
      },
      spec: this.state.currentItem,
    });
    */

    fetch('/bo/api/json_to_yaml', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiVersion: 'proxy.otoroshi.io/v1',
        kind: this.props.kubernetesKind,
        metadata: {
          name,
        },
        spec: this.state.currentItem,
      }),
    })
      .then((r) => r.text())
      .then((yaml) => {
        const blob = new Blob([yaml], { type: 'application/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.id = String(Date.now());
        a.style.display = 'none';
        a.download = `${itemName}-${name}-${Date.now()}.yaml`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 300);
      });
  };

  render() {
    if (this.state.hasError) {
      return <h3>Something went wrong !!!</h3>;
    }
    const windowWidth = window.innerWidth;
    const columns = this.props.columns.map((c) => {
      return {
        Header: c.title,
        id: c.filterId || c.title,
        headerStyle: c.style,
        width: c.style && c.style.width ? c.style.width : undefined,
        style: { ...c.style, height: 30 },
        sortable: !c.notSortable,
        filterable: !c.notFilterable,
        sortMethod: c.sortMethod,
        accessor: (d) => (c.content ? c.content(d) : d),
        // Filter: (d) => {
        //   return <input
        //     type="text"
        //     id={`input-${c.title}`}
        //     className="form-control input-sm"
        //     value={d.filter ? d.filter.value : ''}
        //     onChange={(e) => {
        //       d.onChange(e.target.value)
        //     }}
        //     placeholder="Search ..."
        //   />
        // },
        Cell:
          c.Cell ||
          ((r) => {
            const value = r.value;
            const original = r.original;
            return c.cell ? (
              c.cell(value, original, this)
            ) : (
              <div
                onClick={(e) => {
                  if (this.props.rowNavigation) {
                    if (e.metaKey) {
                      if (this.props.itemUrl) {
                        const a = document.createElement('a');
                        a.setAttribute('target', '_blank');
                        a.setAttribute('href', this.props.itemUrl(original));
                        a.click();
                      }
                    } else {
                      this.gotoItem(e, original);
                    }
                  }
                }}
                style={{ cursor: 'pointer', width: '100%' }}
              >
                {c.wrappedCell ? c.wrappedCell(value, original, this) : value}
              </div>
            );
          }),
      };
    });

    if (this.props.showActions) {
      columns.push({
        Header: 'Actions',
        id: 'actions',
        minWidth: 160,
        maxWidth: 160,
        style: { textAlign: 'left' },
        filterable: false,
        sortable: false,
        accessor: (item) => (
          <div style={{ textAlign: 'left' }}>
            <div>
              <button
                type="button"
                className="btn btn-sm btn-success me-2"
                {...createTooltip(`Edit this ${this.props.itemName}`, 'top', true)}
                onClick={(e) =>
                  this.props.navigateOnEdit
                    ? this.props.navigateOnEdit(item)
                    : this.showEditForm(e, item)
                }
              >
                <i className="fas fa-pencil-alt" />
              </button>
              {this.props.showLink && (
                <a
                  className="btn btn-sm btn-primary me-2"
                  {...createTooltip(`Open this ${this.props.itemName}`, 'top', true)}
                  href={`${this.props.itemUrl(item)}`}
                  onClick={(e) => this.gotoItem(e, item)}
                >
                  <i className="fas fa-link" />
                </a>
              )}
              {this.props.displayTrash && this.props.displayTrash(item) && (
                <button
                  type="button"
                  className="btn btn-sm btn-danger me-2"
                  disabled
                  {...createTooltip(`Delete this ${this.props.itemName}`, 'top', true)}
                >
                  <i className="fas fa-trash" />
                </button>
              )}
              {this.props.displayTrash && !this.props.displayTrash(item) && (
                <button
                  type="button"
                  className="btn btn-sm btn-danger me-2"
                  onClick={(e) => this.deleteItem(e, item)}
                  {...createTooltip(`Delete this ${this.props.itemName}`, 'top', true)}
                >
                  <i className="fas fa-trash" />
                </button>
              )}
              {!this.props.displayTrash && (
                <button
                  type="button"
                  className="btn btn-sm btn-danger me-2"
                  {...createTooltip(`Delete this ${this.props.itemName}`, 'top', true)}
                  onClick={(e) => this.deleteItem(e, item)}
                >
                  <i className="fas fa-trash" />
                </button>
              )}
            </div>
          </div>
        ),
      });
    }

    // console.log(this.state)

    return (
      <div>
        {!this.state.showEditForm && !this.state.showAddForm && (
          <div>
            <div className="row">
              <div
                className=""
                style={{ position: 'absolute', right: 0, top: 34, width: 'fit-content' }}
              >
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  {...createTooltip('Reload the current table')}
                  onClick={this.update}
                >
                  <span className="fas fa-sync" />
                </button>
                {this.props.showActions && !this.props.hideAddItemAction && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ marginLeft: 10 }}
                    onClick={this.showAddForm}
                    {...createTooltip(`Create a new ${this.props.itemName}`)}
                  >
                    <span className="fas fa-plus-circle" /> Add item
                  </button>
                )}
                {this.props.injectTopBar && this.props.injectTopBar()}
              </div>
            </div>
            <div className="rrow" style={{ position: 'relative', marginTop: 20 }}>
              <ReactTable
                ref={this.tableRef}
                className="fulltable -striped -highlight"
                manual
                pages={this.state.pages}
                data={this.state.items}
                loading={this.state.loading}
                defaultPageSize={this.state.rowsPerPage}
                filterable={true}
                filterAll={true}
                defaultSorted={[
                  {
                    id: this.props.defaultSort || this.props.columns[0].title,
                    desc: this.props.defaultSortDesc || false,
                  },
                ]}
                defaultFiltered={
                  this.props.search
                    ? [{ id: this.props.columns[0].title, value: this.props.search }]
                    : []
                }
                onFetchData={(state, instance) => {
                  // console.log(state, instance)
                  // console.log('onFetchData')
                  this.update(state);
                }}
                onFilteredChange={(column, value) => {
                  // console.log('onFilteredChange')
                  if (this.state.lastFocus) document.getElementById(this.state.lastFocus)?.focus();
                }}
                columns={columns}
                LoadingComponent={LoadingComponent}
                defaultFilterMethod={(filter, row, column) => {
                  const id = filter.pivotId || filter.id;
                  if (row[id] !== undefined) {
                    const value = String(row[id]);
                    return value.toLowerCase().indexOf(filter.value.toLowerCase()) > -1;
                  } else {
                    return true;
                  }
                }}
              />
              {!!!window.location.pathname.match(/routes\/([^\s]+)\/events/) && (
                <div
                  className="d-flex align-items-center"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    padding: '6px',
                  }}
                >
                  <p className="m-0 me-2">Rows per page</p>
                  <div style={{ minWidth: '80px' }}>
                    <NgSelectRenderer
                      id="rows-per-page"
                      value={this.state.rowsPerPage}
                      label={' '}
                      ngOptions={{ spread: true }}
                      onChange={(rowsPerPage) => this.setState({ rowsPerPage }, this.update)}
                      options={[5, 15, 20, 50, 100]}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {this.state.showAddForm && (
          <div className="" role="dialog">
            {this.props.formComponent && (
              <>
                {this.props.injectToolbar
                  ? this.props.injectToolbar(this.state, (s) => this.setState(s))
                  : null}
                <form
                  className="form-horizontal"
                  style={{ paddingTop: '30px', ...this.props.style }}
                >
                  {React.createElement(this.props.formComponent, {
                    showAdvancedForm: true,
                    //this.state.showAdvancedForm, // advanced view in creation mode
                    onChange: (currentItem) => {
                      this.setState({ currentItem });

                      if (this.props.parentProps.setTitle)
                        this.props.parentProps.setTitle(
                          `Create a new ${this.props.itemName}`,
                          this.updateItemAndStay,
                          this.state.currentItem
                        );
                    },
                    value: this.state.currentItem,
                    ...(this.props.formPassProps || {}),
                  })}
                </form>
                {this.props.hideAllActions && (
                  <div className="mt-3">
                    {this.props.injectBottomBar &&
                      this.props.injectBottomBar({
                        buttons: (
                          <button
                            type="button"
                            className="btn btn-sm btn-success me-1"
                            onClick={this.createItem}
                          >
                            Create {this.props.itemName}
                          </button>
                        ),
                        closeEditForm: this.closeAddForm,
                        state: this.state,
                        setState: (v) => this.setState(v),
                      })}
                  </div>
                )}
              </>
            )}
            {this.props.formFunction && [
              this.props.injectToolbar
                ? this.props.injectToolbar(this.state, (s) => this.setState(s))
                : null,
              this.props.formFunction({
                value: this.state.currentItem,
                onChange: (currentItem) => this.setState({ currentItem }),
                flow: this.props.formFlow,
                schema: this.props.formSchema,
              }),
            ]}
            {!this.props.formComponent &&
              !this.props.formFunction &&
              (this.actualFlow().find((item) => this.isAnObject(item)) ? (
                <NgForm
                  value={this.state.currentItem}
                  onChange={(currentItem) => this.setState({ currentItem })}
                  flow={this.props.formFlow}
                  schema={this.props.formSchema}
                />
              ) : (
                <Form
                  value={this.state.currentItem}
                  onChange={(currentItem) => this.setState({ currentItem })}
                  flow={this.props.formFlow}
                  schema={this.props.formSchema}
                />
              ))}
            <hr />
            {!this.props.hideAllActions && (
              <>
                <div className="displayGroupBtn float-end">
                  <button type="button" className="btn btn-danger" onClick={this.closeAddForm}>
                    Cancel
                  </button>
                  {this.props.stayAfterSave && (
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={this.createItemAndStay}
                    >
                      Create and stay on this {this.props.itemName}
                    </button>
                  )}
                  <button type="button" className="btn btn-success" onClick={this.createItem}>
                    Create {this.props.itemName}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {this.state.showEditForm && (
          <div className="" role="dialog">
            {this.props.formComponent && [
              this.props.injectToolbar
                ? this.props.injectToolbar(this.state, (s) => this.setState(s))
                : null,
              <form className="form-horizontal" style={{ paddingTop: '30px', ...this.props.style }}>
                {React.createElement(this.props.formComponent, {
                  onChange: (currentItem) => {
                    this.setState({ currentItem });

                    if (this.props.parentProps.setTitle)
                      this.props.parentProps.setTitle(
                        `Update a ${this.props.itemName}`,
                        this.updateItemAndStay,
                        this.state.currentItem
                      );
                  },
                  value: this.state.currentItem,
                  showAdvancedForm: this.state.showAdvancedForm,
                  ...(this.props.formPassProps || {}),
                })}
              </form>,
            ]}
            {this.props.formFunction && [
              this.props.injectToolbar
                ? this.props.injectToolbar(this.state, (s) => this.setState(s))
                : null,
              this.props.formFunction({
                value: this.state.currentItem,
                onChange: (currentItem) => this.setState({ currentItem }),
                flow: this.props.formFlow,
                schema: this.props.formSchema,
              }),
            ]}
            {!this.props.formComponent &&
              !this.props.formFunction &&
              (this.actualFlow().find((item) => this.isAnObject(item)) ? (
                <NgForm
                  value={this.state.currentItem}
                  onChange={(currentItem) => this.setState({ currentItem })}
                  flow={this.props.formFlow}
                  schema={this.props.formSchema}
                />
              ) : (
                <Form
                  value={this.state.currentItem}
                  onChange={(currentItem) => this.setState({ currentItem })}
                  flow={this.props.formFlow}
                  schema={this.props.formSchema}
                />
              ))}
            <hr />
            <div className="displayGroupBtn float-end">
              {this.props.displayTrash && this.props.displayTrash(this.state.currentItem) && (
                <button
                  type="button"
                  className="btn btn-danger"
                  title="Delete current item"
                  disabled
                >
                  <i className="fas fa-trash" /> Delete
                </button>
              )}
              {this.props.displayTrash && !this.props.displayTrash(this.state.currentItem) && (
                <button
                  type="button"
                  className="btn btn-danger"
                  title="Delete current item"
                  onClick={(e) => this.deleteItem(e, this.state.currentItem)}
                >
                  <i className="fas fa-trash" /> Delete
                </button>
              )}
              {this.props.export && (
                <>
                  <button
                    onClick={this.exportJson}
                    type="button"
                    className="btn btn-primary"
                    title="Export as json"
                  >
                    <i className="fas fa-file-export me-2" />
                    Export JSON
                  </button>
                  <button
                    onClick={this.exportYaml}
                    type="button"
                    className="btn btn-primary"
                    title="Export as yaml"
                  >
                    <i className="fas fa-file-export me-2" />
                    Export YAML
                  </button>
                </>
              )}
              {!this.props.displayTrash && !this.props.newForm && (
                <button
                  type="button"
                  className="btn btn-danger"
                  title="Delete current item"
                  onClick={(e) => this.deleteItem(e, this.state.currentItem)}
                >
                  <i className="fas fa-trash" /> Delete
                </button>
              )}
              {!this.props.newForm && (
                <button type="button" className="btn btn-danger" onClick={this.closeEditForm}>
                  <i className="fas fa-times" /> Cancel
                </button>
              )}
              {this.props.stayAfterSave && !this.props.newForm && (
                <button type="button" className="btn btn-success" onClick={this.updateItemAndStay}>
                  Update and stay on this {this.props.itemName}
                </button>
              )}
              {!this.props.newForm && (
                <button type="button" className="btn btn-success" onClick={this.updateItem}>
                  Update {this.props.itemName}
                </button>
              )}

              {this.props.injectBottomBar &&
                this.props.injectBottomBar({
                  closeEditForm: this.closeEditForm,
                  state: this.state,
                  setState: (v) => this.setState(v),
                })}
            </div>
          </div>
        )}
      </div>
    );
  }
}
