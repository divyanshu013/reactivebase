import React, { Component } from "react";
import Select from "react-select";
import classNames from "classnames";
import manager from "../middleware/ChannelManager";
import InitialLoader from "../addons/InitialLoader";
import _ from "lodash";

const helper = require("../middleware/helper");

export default class DropdownList extends Component {
	constructor(props) {
		super(props);
		this.state = {
			items: [],
			value: "",
			rawData: {
				hits: {
					hits: []
				}
			}
		};
		this.sortObj = {
			aggSort: this.props.sortBy
		};
		this.selectAll = false;
		this.channelId = null;
		this.channelListener = null;
		this.previousSelectedSensor = {};
		this.urlParams = helper.URLParams.get(this.props.componentId, this.props.multipleSelect);
		this.handleChange = this.handleChange.bind(this);
		this.type = this.props.multipleSelect ? "Terms" : "Term";
		this.customQuery = this.customQuery.bind(this);
		this.renderOption = this.renderOption.bind(this);
	}

	// Get the items from Appbase when component is mounted
	componentDidMount() {
		this.size = this.props.size;
		this.setQueryInfo();
		this.checkDefault(this.props);
		this.createChannel(true);
		this.listenFilter();
	}

	componentWillReceiveProps(nextProps) {
		const items = this.state.items;
		this.checkDefault(nextProps);
		if (nextProps.selectAllLabel !== this.props.selectAllLabel) {
			if (this.props.selectAllLabel) {
				items.shift();
			}
			items.unshift({ label: nextProps.selectAllLabel, value: nextProps.selectAllLabel });
			this.setState({
				items
			});
		}
	}

	componentWillUnmount() {
		if(this.filterListener) {
			this.filterListener.remove();
		}
	}

	listenFilter() {
		this.filterListener = helper.sensorEmitter.addListener("clearFilter", (data) => {
			if(data === this.props.componentId) {
				this.defaultSelected = null;
				this.handleChange(null);
			}
		});
	}

	checkDefault(props) {
		this.urlParams = helper.URLParams.get(props.componentId, props.multipleSelect);
		const defaultValue = this.urlParams !== null ? this.urlParams : props.defaultSelected;
		this.changeValue(defaultValue);
	}

	changeValue(defaultValue) {
		if (this.props.multipleSelect) {
			if (!_.isEqual(this.defaultSelected, defaultValue)) {
				this.defaultSelected = defaultValue;
				const records = this.state.items.filter(record => this.defaultSelected.indexOf(record.value) > -1);
				if (records.length) {
					this.handleChange(records);
				} else {
					this.handleChange([{value: this.defaultSelected}]);
				}
			}
		} else if (this.defaultSelected !== defaultValue) {
			this.defaultSelected = defaultValue;
			const records = this.state.items.filter(record => record.value === this.defaultSelected);
			if (records.length) {
				this.handleChange(records);
			} else {
				this.handleChange({value: this.defaultSelected});
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
	}

	// stop streaming request and remove listener when component will unmount
	componentWillUnmount() {
		this.removeChannel();
	}

	removeChannel() {
		if (this.channelId) {
			manager.stopStream(this.channelId);
		}
		if (this.channelListener) {
			this.channelListener.remove();
		}
		if (this.loadListener) {
			this.loadListener.remove();
		}
	}

	// build query for this sensor only
	customQuery(value) {
		if (this.selectAll) {
			return {
				exists: {
					field: [this.props.appbaseField]
				}
			};
		} else if (value) {
			return {
				[this.type]: {
					[this.props.appbaseField]: value
				}
			};
		}
	}

	// set the query type and input data
	setQueryInfo() {
		const obj = {
			key: this.props.componentId,
			value: {
				queryType: this.type,
				inputData: this.props.appbaseField,
				customQuery: this.props.customQuery ? this.props.customQuery : this.customQuery
			}
		};
		helper.selectedSensor.setSensorInfo(obj);
	}

	includeAggQuery() {
		const obj = {
			key: `${this.props.componentId}-sort`,
			value: this.sortObj
		};
		helper.selectedSensor.setSortInfo(obj);
	}

	handleSortSelect() {
		this.sortObj = {
			aggSort: this.props.sortBy
		};
		const obj = {
			key: `${this.props.componentId}-sort`,
			value: this.sortObj
		};
		if (this.props.onValueChange) {
			this.props.onValueChange(obj.value);
		}
		helper.selectedSensor.set(obj, true, "sortChange");
	}

	// Create a channel which passes the react and receive results whenever react changes
	createChannel(executeChannel = false) {
		// Set the react - add self aggs query as well with react
		let react = this.props.react ? this.props.react : {};
		react.aggs = {
			key: this.props.appbaseField,
			sort: this.props.sortBy,
			size: this.props.size,
			sortRef: `${this.props.componentId}-sort`
		};
		const reactAnd = [`${this.props.componentId}-sort`, "dropdownListChanges"]
		react = helper.setupReact(react, reactAnd);
		this.includeAggQuery();
		// create a channel and listen the changes
		const channelObj = manager.create(this.context.appbaseRef, this.context.type, react, 100, 0, false, this.props.componentId);
		this.channelId = channelObj.channelId;
		this.channelListener = channelObj.emitter.addListener(channelObj.channelId, (res) => {
			if (res.error) {
				this.setState({
					queryStart: false
				});
			}
			if (res.appliedQuery) {
				const data = res.data;
				let rawData;
				if (res.mode === "streaming") {
					rawData = this.state.rawData;
					rawData.hits.hits.push(res.data);
				} else if (res.mode === "historic") {
					rawData = data;
				}
				this.setState({
					queryStart: false,
					rawData
				});
				this.setData(rawData);
			}
		});
		if (executeChannel) {
			setTimeout(() => {
				const obj = {
					key: "dropdownListChanges",
					value: ""
				};
				helper.selectedSensor.set(obj, true);
			}, 100);
		}
		this.listenLoadingChannel(channelObj);
	}

	listenLoadingChannel(channelObj) {
		this.loadListener = channelObj.emitter.addListener(`${channelObj.channelId}-query`, (res) => {
			if (res.appliedQuery) {
				this.setState({
					queryStart: res.queryState
				});
			}
		});
	}

	setData(data) {
		if (data.aggregations && data.aggregations[this.props.appbaseField] && data.aggregations[this.props.appbaseField].buckets) {
			this.addItemsToList(data.aggregations[this.props.appbaseField].buckets);
		}
	}

	renderOption(option) {
		return (
			<span key={option.value}>{option.value} {this.props.showCount && option.count ? (<span className="rbc-count">{option.count}</span>) : null}</span>
		);
	}

	addItemsToList(newItems) {
		newItems = newItems.map((item) => {
			item.label = item.key.toString();
			item.value = item.key.toString();
			item.count = null;
			if (this.props.showCount) {
				item.count = item.doc_count;
			}
			return item;
		});
		newItems = newItems.filter(item => item && item.label && item.label.trim());
		if (this.props.selectAllLabel) {
			newItems.unshift({ label: this.props.selectAllLabel, value: this.props.selectAllLabel });
		}
		this.setState({
			items: newItems
		});
		if (this.defaultSelected) {
			if (this.props.multipleSelect) {
				const records = this.state.items.filter(record => this.defaultSelected.indexOf(record.value) > -1);
				if (records.length) {
					this.handleChange(records);
				}
			} else {
				const records = this.state.items.filter(record => record.value === this.defaultSelected);
				if (records.length) {
					this.handleChange(records[0]);
				}
			}
		}
	}

	// Handler function when a value is selected
	handleChange(value) {
		let result;
		this.selectAll = false;
		if (this.props.multipleSelect) {
			if(value) {
				result = [];
				value.map((item) => {
					result.push(item.value);
				});
				if (this.props.selectAllLabel && (result.indexOf(this.props.selectAllLabel) > -1)) {
					result = this.props.selectAllLabel;
					this.selectAll = true;
				} else {
					result = result.join();
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
		this.setState({
			value: result
		});

		this.setValue(result, true);
	}

	// set value
	setValue(value, isExecuteQuery = false) {
		if (this.props.multipleSelect && value) {
			value = _.isArray(value) ? value : value.split(",");
			value = value.length ? value : null;
		}
		value = value === "" ? null : value;
		const obj = {
			key: this.props.componentId,
			value
		};
		helper.URLParams.update(this.props.componentId, value, this.props.URLParams);
		helper.selectedSensor.set(obj, isExecuteQuery);
	}

	render() {
		// Checking if component is single select or multiple select
		let title = null;
		if (this.props.title) {
			title = (<h4 className="rbc-title col s12 col-xs-12">{this.props.title}</h4>);
		}

		const cx = classNames({
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
			return (
				<div className={`rbc col s12 col-xs-12 card thumbnail ${cx}`} style={this.props.componentStyle}>
					<div className="row">
						{title}
						<div className="col s12 col-xs-12">
							<Select
								options={this.state.items}
								clearable={false}
								value={this.state.value}
								onChange={this.handleChange}
								multi={this.props.multipleSelect}
								cache={false}
								placeholder={this.props.placeholder}
								optionRenderer={this.renderOption}
								searchable
							/>
						</div>
					</div>
					{this.props.initialLoader && this.state.queryStart ? (<InitialLoader defaultText={this.props.initialLoader} />) : null}
				</div>
			);
		}

		return null;
	}
}

DropdownList.propTypes = {
	componentId: React.PropTypes.string.isRequired,
	appbaseField: React.PropTypes.string.isRequired,
	title: React.PropTypes.oneOfType([
		React.PropTypes.string,
		React.PropTypes.element
	]),
	size: helper.sizeValidation,
	multipleSelect: React.PropTypes.bool,
	showCount: React.PropTypes.bool,
	sortBy: React.PropTypes.oneOf(["asc", "desc", "count"]),
	placeholder: React.PropTypes.string,
	selectAllLabel: React.PropTypes.string,
	initialLoader: React.PropTypes.oneOfType([
		React.PropTypes.string,
		React.PropTypes.element
	]),
	defaultSelected: React.PropTypes.oneOfType([
		React.PropTypes.string,
		React.PropTypes.array
	]),
	customQuery: React.PropTypes.func,
	react: React.PropTypes.object,
	onValueChange: React.PropTypes.func,
	componentStyle: React.PropTypes.object,
	URLParams: React.PropTypes.bool,
	allowFilter: React.PropTypes.bool
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
	allowFilter: true
};

// context type
DropdownList.contextTypes = {
	appbaseRef: React.PropTypes.any.isRequired,
	type: React.PropTypes.any.isRequired
};
