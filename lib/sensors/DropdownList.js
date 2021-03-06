import _isEqual from "lodash/isEqual";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

import React, { Component } from "react";
import Select from "react-select";
import classNames from "classnames";
import manager from "../middleware/ChannelManager";
import InitialLoader from "../addons/InitialLoader";


var helper = require("../middleware/helper");

var DropdownList = function (_Component) {
	_inherits(DropdownList, _Component);

	function DropdownList(props) {
		_classCallCheck(this, DropdownList);

		var _this = _possibleConstructorReturn(this, _Component.call(this, props));

		_this.state = {
			items: [],
			value: "",
			rawData: {
				hits: {
					hits: []
				}
			}
		};
		_this.sortObj = {
			aggSort: _this.props.sortBy
		};
		_this.selectAll = false;
		_this.channelId = null;
		_this.channelListener = null;
		_this.previousSelectedSensor = {};
		_this.urlParams = helper.URLParams.get(_this.props.componentId, _this.props.multipleSelect);
		_this.handleChange = _this.handleChange.bind(_this);
		_this.type = _this.props.multipleSelect && _this.props.queryFormat === "or" ? "Terms" : "Term";
		_this.customQuery = _this.customQuery.bind(_this);
		_this.renderOption = _this.renderOption.bind(_this);
		return _this;
	}

	// Get the items from Appbase when component is mounted


	DropdownList.prototype.componentWillMount = function componentWillMount() {
		this.setReact(this.props);
		this.size = this.props.size;
		this.setQueryInfo();
		this.checkDefault(this.props);
		this.createChannel(true);
		this.listenFilter();
	};

	DropdownList.prototype.componentWillReceiveProps = function componentWillReceiveProps(nextProps) {
		var items = this.state.items;


		if (!_isEqual(this.props.react, nextProps.react)) {
			this.setReact(nextProps);
			manager.update(this.channelId, this.react, nextProps.size, 0, false);
		}

		if (nextProps.multipleSelect && !_isEqual(this.props.defaultSelected, nextProps.defaultSelected)) {
			this.changeValue(nextProps.defaultSelected);
		} else if (!nextProps.multipleSelect && this.props.defaultSelected !== nextProps.defaultSelected) {
			this.changeValue(nextProps.defaultSelected);
		}

		if (nextProps.selectAllLabel !== this.props.selectAllLabel) {
			if (this.props.selectAllLabel) {
				items.shift();
			}
			items.unshift({ label: nextProps.selectAllLabel, value: nextProps.selectAllLabel });
			this.setState({
				items: items
			});
		}
	};

	DropdownList.prototype.componentWillUnmount = function componentWillUnmount() {
		if (this.filterListener) {
			this.filterListener.remove();
		}
		// stop streaming request and remove listener when component will unmount
		this.removeChannel();
	};

	DropdownList.prototype.listenFilter = function listenFilter() {
		var _this2 = this;

		this.filterListener = helper.sensorEmitter.addListener("clearFilter", function (data) {
			if (data === _this2.props.componentId) {
				_this2.defaultSelected = null;
				_this2.handleChange(null);
			}
		});
	};

	DropdownList.prototype.checkDefault = function checkDefault(props) {
		this.urlParams = helper.URLParams.get(props.componentId, props.multipleSelect);
		var defaultValue = this.urlParams !== null ? this.urlParams : props.defaultSelected;
		this.changeValue(defaultValue);
	};

	DropdownList.prototype.changeValue = function changeValue(defaultValue) {
		var _this3 = this;

		if (this.props.multipleSelect) {
			if (!_isEqual(this.defaultSelected, defaultValue)) {
				this.defaultSelected = defaultValue;
				var records = this.state.items.filter(function (record) {
					return _this3.defaultSelected.indexOf(record.value) > -1;
				});
				if (records.length) {
					this.handleChange(records);
				} else {
					this.handleChange(this.defaultSelected.map(function (item) {
						return {
							value: item
						};
					}));
				}
			}
		} else if (this.defaultSelected !== defaultValue) {
			this.defaultSelected = defaultValue;
			var _records = this.state.items.filter(function (record) {
				return record.value === _this3.defaultSelected;
			});

			if (_records.length) {
				this.handleChange(_records);
			} else {
				this.handleChange({ value: this.defaultSelected });
			}
		}
		if (this.sortBy !== this.props.sortBy) {
			this.sortBy = this.props.sortBy;
			this.handleSortSelect();
		}
		if (this.size !== this.props.size) {
			this.size = this.props.size;
			this.removeChannel();
			this.createChannel();
		}
	};

	DropdownList.prototype.removeChannel = function removeChannel() {
		if (this.channelId) {
			manager.stopStream(this.channelId);
		}
		if (this.channelListener) {
			this.channelListener.remove();
		}
		if (this.loadListener) {
			this.loadListener.remove();
		}
	};

	// build query for this sensor only


	DropdownList.prototype.customQuery = function customQuery(value) {
		var _this4 = this;

		if (this.selectAll) {
			return {
				exists: {
					field: [this.props.appbaseField]
				}
			};
		} else if (value) {
			var _type, _ref2;

			// queryFormat should not affect SingleDropdownList
			if (this.props.queryFormat === "and" && this.props.multipleSelect) {
				// adds a sub-query with must as an array of objects for each terms/value
				var queryArray = value.map(function (item) {
					var _this4$type, _ref;

					return _ref = {}, _ref[_this4.type] = (_this4$type = {}, _this4$type[_this4.props.appbaseField] = item, _this4$type), _ref;
				});
				return {
					bool: {
						must: queryArray
					}
				};
			}

			// for the default queryFormat = "or" and SingleDropdownList
			return _ref2 = {}, _ref2[this.type] = (_type = {}, _type[this.props.appbaseField] = value, _type), _ref2;
		}
	};

	// set the query type and input data


	DropdownList.prototype.setQueryInfo = function setQueryInfo() {
		var obj = {
			key: this.props.componentId,
			value: {
				queryType: this.type,
				inputData: this.props.appbaseField,
				customQuery: this.props.customQuery ? this.props.customQuery : this.customQuery,
				reactiveId: this.context.reactiveId,
				showFilter: this.props.showFilter,
				filterLabel: this.props.filterLabel ? this.props.filterLabel : this.props.componentId,
				component: this.props.component,
				defaultSelected: this.urlParams !== null ? this.urlParams : this.props.defaultSelected
			}
		};
		helper.selectedSensor.setSensorInfo(obj);
	};

	DropdownList.prototype.includeAggQuery = function includeAggQuery() {
		var obj = {
			key: this.props.componentId + "-sort",
			value: this.sortObj
		};
		helper.selectedSensor.setSortInfo(obj);
	};

	DropdownList.prototype.handleSortSelect = function handleSortSelect() {
		this.sortObj = {
			aggSort: this.props.sortBy
		};
		var obj = {
			key: this.props.componentId + "-sort",
			value: this.sortObj
		};
		helper.selectedSensor.set(obj, true, "sortChange");
	};

	DropdownList.prototype.setReact = function setReact(props) {
		// Set the react - add self aggs query as well with react
		var react = Object.assign({}, props.react);
		react.aggs = {
			key: props.appbaseField,
			sort: props.sortBy,
			size: props.size,
			sortRef: props.componentId + "-sort"
		};
		var reactAnd = [props.componentId + "-sort", "dropdownListChanges"];
		this.react = helper.setupReact(react, reactAnd);
	};

	// Create a channel which passes the react and receive results whenever react changes


	DropdownList.prototype.createChannel = function createChannel() {
		var _this5 = this;

		var executeChannel = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

		this.includeAggQuery();
		// create a channel and listen the changes
		var channelObj = manager.create(this.context.appbaseRef, this.context.type, this.react, 100, 0, false, this.props.componentId);
		this.channelId = channelObj.channelId;
		this.channelListener = channelObj.emitter.addListener(channelObj.channelId, function (res) {
			if (res.error) {
				_this5.setState({
					queryStart: false
				});
			}
			if (res.appliedQuery) {
				var data = res.data;
				var rawData = void 0;
				if (res.mode === "streaming") {
					rawData = _this5.state.rawData;
					rawData.hits.hits.push(res.data);
				} else if (res.mode === "historic") {
					rawData = data;
				}
				_this5.setState({
					queryStart: false,
					rawData: rawData
				});
				_this5.setData(rawData);
			}
		});
		this.listenLoadingChannel(channelObj);
	};

	DropdownList.prototype.listenLoadingChannel = function listenLoadingChannel(channelObj) {
		var _this6 = this;

		this.loadListener = channelObj.emitter.addListener(channelObj.channelId + "-query", function (res) {
			if (res.appliedQuery) {
				_this6.setState({
					queryStart: res.queryState
				});
			}
		});
	};

	DropdownList.prototype.setData = function setData(data) {
		if (data.aggregations && data.aggregations[this.props.appbaseField] && data.aggregations[this.props.appbaseField].buckets) {
			this.addItemsToList(data.aggregations[this.props.appbaseField].buckets);
		}
	};

	DropdownList.prototype.renderOption = function renderOption(option) {
		return React.createElement(
			"span",
			{ key: option.value },
			option.value,
			" ",
			this.props.showCount && option.count ? React.createElement(
				"span",
				{ className: "rbc-count" },
				option.count
			) : null
		);
	};

	DropdownList.prototype.addItemsToList = function addItemsToList(newItems) {
		var _this7 = this;

		newItems = newItems.map(function (item) {
			item.label = item.key.toString();
			item.value = item.key.toString();
			item.count = null;
			if (_this7.props.showCount) {
				item.count = item.doc_count;
			}
			return item;
		});
		newItems = newItems.filter(function (item) {
			return item && item.label && item.label.trim();
		});
		if (this.props.selectAllLabel) {
			newItems.unshift({ label: this.props.selectAllLabel, value: this.props.selectAllLabel });
		}
		this.setState({
			items: newItems
		});
		if (this.defaultSelected) {
			if (this.props.multipleSelect) {
				var records = this.state.items.filter(function (record) {
					return _this7.defaultSelected.indexOf(record.value) > -1;
				});
				if (records.length) {
					this.handleChange(records);
				}
			} else {
				var _records2 = this.state.items.filter(function (record) {
					return record.value === _this7.defaultSelected;
				});
				if (_records2.length) {
					this.handleChange(_records2[0]);
				}
			}
		}
	};

	// Handler function when a value is selected


	DropdownList.prototype.handleChange = function handleChange(value) {
		var result = void 0;
		this.selectAll = false;
		if (this.props.multipleSelect) {
			if (value) {
				result = value.map(function (item) {
					return item.value;
				});

				if (this.props.selectAllLabel && result.indexOf(this.props.selectAllLabel) > -1) {
					result = this.props.selectAllLabel;
					this.selectAll = true;
				}
			} else {
				result = null;
			}
		} else {
			result = value ? value.value : value;
			if (this.props.selectAllLabel && result === this.props.selectAllLabel) {
				this.selectAll = true;
			}
		}

		// string for single and array for multiple
		this.setState({
			value: result
		});

		this.setValue(result, true);
	};

	// set value


	DropdownList.prototype.setValue = function setValue(value) {
		var _this8 = this;

		var isExecuteQuery = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

		if (this.props.multipleSelect && value) {
			value = value.length ? value : null;
		}
		value = value === "" ? null : value;
		var obj = {
			key: this.props.componentId,
			value: value
		};

		var execQuery = function execQuery() {
			if (_this8.props.onValueChange) {
				_this8.props.onValueChange(value);
			}
			helper.URLParams.update(_this8.props.componentId, value, _this8.props.URLParams);
			helper.selectedSensor.set(obj, isExecuteQuery);
		};

		if (this.props.beforeValueChange) {
			this.props.beforeValueChange(obj.value).then(function () {
				execQuery();
			}).catch(function (e) {
				console.warn(_this8.props.componentId + " - beforeValueChange rejected the promise with", e);
			});
		} else {
			execQuery();
		}
	};

	DropdownList.prototype.render = function render() {
		// Checking if component is single select or multiple select
		var title = null;
		if (this.props.title) {
			title = React.createElement(
				"h4",
				{ className: "rbc-title col s12 col-xs-12" },
				this.props.title
			);
		}

		var cx = classNames({
			"rbc-title-active": this.props.title,
			"rbc-title-inactive": !this.props.title,
			"rbc-placeholder-active": this.props.placeholder,
			"rbc-placeholder-inactive": !this.props.placeholder,
			"rbc-multidropdownlist": this.props.multipleSelect,
			"rbc-singledropdownlist": !this.props.multipleSelect,
			"rbc-count-active": this.props.showCount,
			"rbc-count-inactive": !this.props.showCount,
			"rbc-initialloader-active": this.props.initialLoader,
			"rbc-initialloader-inactive": !this.props.initialLoader
		});

		if (this.state.items.length) {
			return React.createElement(
				"div",
				{ className: "rbc col s12 col-xs-12 card thumbnail " + cx, style: this.props.componentStyle },
				React.createElement(
					"div",
					{ className: "row" },
					title,
					React.createElement(
						"div",
						{ className: "col s12 col-xs-12" },
						React.createElement(Select, {
							options: this.state.items,
							clearable: false,
							value: this.state.value,
							onChange: this.handleChange,
							multi: this.props.multipleSelect,
							cache: false,
							placeholder: this.props.placeholder,
							optionRenderer: this.renderOption,
							searchable: true
						})
					)
				),
				this.props.initialLoader && this.state.queryStart ? React.createElement(InitialLoader, { defaultText: this.props.initialLoader }) : null
			);
		}

		return null;
	};

	return DropdownList;
}(Component);

export default DropdownList;


DropdownList.propTypes = {
	componentId: React.PropTypes.string.isRequired,
	appbaseField: React.PropTypes.string.isRequired,
	title: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.element]),
	size: helper.sizeValidation,
	multipleSelect: React.PropTypes.bool,
	showCount: React.PropTypes.bool,
	sortBy: React.PropTypes.oneOf(["asc", "desc", "count"]),
	placeholder: React.PropTypes.string,
	selectAllLabel: React.PropTypes.string,
	initialLoader: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.element]),
	defaultSelected: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.array]),
	customQuery: React.PropTypes.func,
	react: React.PropTypes.object,
	beforeValueChange: React.PropTypes.func,
	onValueChange: React.PropTypes.func,
	componentStyle: React.PropTypes.object,
	URLParams: React.PropTypes.bool,
	showFilter: React.PropTypes.bool,
	filterLabel: React.PropTypes.string,
	queryFormat: React.PropTypes.oneOf(["and", "or"])
};

// Default props value
DropdownList.defaultProps = {
	showCount: true,
	sortBy: "count",
	size: 100,
	title: null,
	placeholder: "Select...",
	selectAllLabel: null,
	URLParams: false,
	showFilter: true,
	queryFormat: "or"
};

// context type
DropdownList.contextTypes = {
	appbaseRef: React.PropTypes.any.isRequired,
	type: React.PropTypes.any.isRequired,
	reactiveId: React.PropTypes.number
};