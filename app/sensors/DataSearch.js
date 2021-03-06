import React, { Component } from "react";
import Autosuggest from "react-autosuggest";
import classNames from "classnames";
import manager from "../middleware/ChannelManager";
import * as TYPES from "../middleware/constants";
import _ from "lodash";

const helper = require("../middleware/helper");

export default class DataSearch extends Component {
	constructor(props) {
		super(props);
		this.state = {
			items: [],
			currentValue: null,
			isLoading: false,
			options: [],
			rawData: {
				hits: {
					hits: []
				}
			}
		};
		this.type = "match_phrase";
		this.searchInputId = `internal-${this.props.componentId}`;
		this.channelId = null;
		this.channelListener = null;
		this.fieldType = typeof this.props.appbaseField;
		this.handleSearch = this.handleSearch.bind(this);
		this.handleInputChange = this.handleInputChange.bind(this);
		this.setValue = this.setValue.bind(this);
		this.onInputChange = this.onInputChange.bind(this);
		this.onSuggestionSelected = this.onSuggestionSelected.bind(this);
		this.handleBlur = this.handleBlur.bind(this);
		this.handleKeyPress = this.handleKeyPress.bind(this);
		this.defaultSearchQuery = this.defaultSearchQuery.bind(this);
		this.previousSelectedSensor = {};
		this.urlParams = helper.URLParams.get(this.props.componentId);
	}

	// Get the items from Appbase when component is mounted
	componentWillMount() {
		this.setReact(this.props);
		this.setQueryInfo();
		this.createChannel();
		this.checkDefault();
		this.listenFilter();
	}

	componentWillReceiveProps(nextProps) {
		if (!_.isEqual(this.props.react, nextProps.react)) {
			this.setReact(nextProps);
			manager.update(this.channelId, this.react, null, null, false);
		}

		if (this.props.defaultSelected !== nextProps.defaultSelected) {
			this.changeValue(nextProps.defaultSelected);
		} else if (nextProps.customQuery) {
			if (this.props.customQuery) {
				if (!_.isEqual(nextProps.customQuery(this.state.currentValue), this.props.customQuery(this.state.currentValue))) {
					this.handleSearch({
						value: this.state.currentValue
					});
				}
			} else {
				this.handleSearch({
					value: this.state.currentValue
				});
			}
		}
	}

	// stop streaming request and remove listener when component will unmount
	componentWillUnmount() {
		if (this.channelId) {
			manager.stopStream(this.channelId);
		}
		if (this.channelListener) {
			this.channelListener.remove();
		}
		if(this.filterListener) {
			this.filterListener.remove();
		}
	}

	listenFilter() {
		this.filterListener = helper.sensorEmitter.addListener("clearFilter", (data) => {
			if(data === this.props.componentId) {
				this.defaultValue = "";
				this.changeValue(this.defaultValue);
			}
		});
	}

	highlightQuery() {
		const fields = {};
		const highlightField = this.props.highlightField ? this.props.highlightField : this.props.appbaseField;
		if (typeof highlightField === "string") {
			fields[highlightField] = {};
		} else if (Array.isArray(highlightField)) {
			highlightField.forEach((item) => {
				fields[item] = {};
			});
		}
		return {
			highlight: {
				pre_tags: ["<span class=\"rbc-highlight\">"],
				post_tags: ["</span>"],
				fields
			}
		};
	}

	// set the query type and input data
	setQueryInfo() {
		const obj = {
			key: this.props.componentId,
			value: {
				queryType: this.type,
				inputData: this.props.appbaseField,
				customQuery: this.props.customQuery ? this.props.customQuery : this.defaultSearchQuery,
				reactiveId: this.context.reactiveId,
				showFilter: this.props.showFilter,
				filterLabel: this.props.filterLabel ? this.props.filterLabel : this.props.componentId,
				component: "DataSearch",
				defaultSelected: this.urlParams !== null ? this.urlParams : this.props.defaultSelected
			}
		};
		if (this.props.highlight) {
			obj.value.externalQuery = this.highlightQuery();
		}
		helper.selectedSensor.setSensorInfo(obj);
		const searchObj = {
			key: this.searchInputId,
			value: {
				queryType: "multi_match",
				inputData: this.props.appbaseField,
				customQuery: this.defaultSearchQuery,
				component: "DataSearchInternal"
			}
		};
		helper.selectedSensor.setSensorInfo(searchObj);
	}

	// set value to search
	setValue(value) {
		const obj = {
			key: this.searchInputId,
			value
		};

		const execQuery = () => {
			if (this.props.onValueChange) {
				this.props.onValueChange(obj.value);
			}

			this.defaultSelected = value;
			helper.URLParams.update(this.props.componentId, value, this.props.URLParams);
			helper.selectedSensor.set(obj, true);

			if (value && value.trim() !== "") {
				this.setState({
					options: [{
						label: value,
						value
					}],
					isLoadingOptions: true,
					currentValue: value
				});
			} else {
				this.setState({
					options: [],
					isLoadingOptions: false,
					currentValue: value
				});
			}
		};

		if (this.props.beforeValueChange) {
			this.props.beforeValueChange(obj.value)
			.then(() => {
				execQuery();
			})
			.catch((e) => {
				console.warn(`${this.props.componentId} - beforeValueChange rejected the promise with`, e);
			});
		} else {
			execQuery();
		}
	}

	getValue(field, hit, index = 0) {
		let val;
		if (_.has(hit, field)) {
			val = hit[field];
		} else if (field.indexOf(".") > -1) {
			let prefix = "";
			const fieldSplit = field.split(".");
			fieldSplit.forEach((item, index) => {
				prefix += item;
				if (Array.isArray(_.get(hit, prefix))) {
					prefix += `[${index}]`;
				}
				if (fieldSplit.length - 1 !== index) {
					prefix += ".";
				} else {
					val = _.get(hit, prefix);
				}
			});
		}
		return val;
	}

	// Search results often contain duplicate results, so display only unique values
	removeDuplicates(myArr, prop) {
		return myArr.filter((obj, pos, arr) => arr.map(mapObj => mapObj[prop]).indexOf(obj[prop]) === pos);
	}

	// set data after get the result
	setData(data) {
		let options = [];
		const appbaseField = Array.isArray(this.props.appbaseField) ? this.props.appbaseField : [this.props.appbaseField];
		data.hits.hits.map((hit) => {
			if (this.fieldType === "string") {
				const tempField = this.getValue(this.props.appbaseField.trim(), hit._source);
				options.push({ value: tempField, label: tempField });
			} else if (this.fieldType === "object") {
				this.props.appbaseField.map((field) => {
					const tempField = this.getValue(field, hit._source);
					if (tempField) {
						options.push({ value: tempField, label: tempField });
					}
				});
			}
		});
		if (this.state.currentValue && this.state.currentValue.trim() !== "") {
			options.unshift({
				label: this.state.currentValue,
				value: this.state.currentValue
			});
		}
		options = this.removeDuplicates(options, "label");
		this.setState({
			options,
			isLoadingOptions: false
		});
	}

	// default query
	defaultSearchQuery(value) {
		let finalQuery = null,
			fields;
		if (value) {
			if (this.fieldType === "string") {
				fields = [this.props.appbaseField];
			} else {
				fields = this.props.appbaseField;
			}
			finalQuery = {
				bool: {
					should: this.shouldQuery(value, fields),
					minimum_should_match: "1"
				}
			};
		}

		if (value === "") {
			finalQuery = {
				"match_all": {}
			}
		}

		return finalQuery;
	}

	shouldQuery(value, appbaseFields) {
		const fields = appbaseFields.map(
			(field, index) => `${field}${(Array.isArray(this.props.weights) && this.props.weights[index]) ? ("^" + this.props.weights[index]) : ""}`
		);

		if (this.props.queryFormat === "and") {
			return [
				{
					multi_match: {
						query: value,
						fields,
						type: "cross_fields",
						operator: "and",
						fuzziness: this.props.fuzziness ? this.props.fuzziness : 0
					}
				},
				{
					multi_match: {
						query: value,
						fields,
						type: "phrase_prefix",
						operator: "and"
					}
				}
			];
		}

		return [
			{
				multi_match: {
					query: value,
					fields,
					type: "best_fields",
					operator: "or",
					fuzziness: this.props.fuzziness ? this.props.fuzziness : 0
				}
			},
			{
				multi_match: {
					query: value,
					fields,
					type: "phrase_prefix",
					operator: "or"
				}
			}
		];
	}

	setReact(props) {
		const react = Object.assign({}, props.react);
		const reactAnd = [this.searchInputId];
		this.react = helper.setupReact(react, reactAnd);
	}

	// Create a channel which passes the react and receive results whenever react changes
	createChannel() {
		const channelObj = manager.create(this.context.appbaseRef, this.context.type, this.react, 100, 0, false, this.props.componentId);
		this.channelId = channelObj.channelId;
		this.channelListener = channelObj.emitter.addListener(channelObj.channelId, (res) => {
			const data = res.data;
			let rawData;
			if (res.mode === "streaming") {
				rawData = this.state.rawData;
				rawData.hits.hits.push(res.data);
			} else if (res.mode === "historic") {
				rawData = data;
			}
			this.setState({
				rawData
			});
			if (this.props.autoSuggest) {
				this.setData(rawData);
			}
		});
	}

	checkDefault() {
		this.defaultValue = this.urlParams !== null ? this.urlParams : this.props.defaultSelected;
		this.changeValue(this.defaultValue);
	}

	changeValue(defaultValue) {
		if (this.defaultSelected != defaultValue) {
			this.defaultSelected = defaultValue;
			setTimeout(this.setValue.bind(this, this.defaultSelected), 100);
			this.handleSearch({
				value: this.defaultSelected
			});
		}
	}

	// When user has selected a search value
	handleSearch(currentValue) {
		let value = currentValue ? currentValue.value : null;
		value = value === "null" ? null : value;

		const obj = {
			key: this.props.componentId,
			value
		};

		const execQuery = () => {
			if (this.props.onValueChange) {
				this.props.onValueChange(obj.value);
			}

			helper.URLParams.update(this.props.componentId, value, this.props.URLParams);
			helper.selectedSensor.set(obj, true);
			this.setState({
				currentValue: value
			});
		};

		if (this.props.beforeValueChange) {
			this.props.beforeValueChange(obj.value)
			.then(() => {
				execQuery();
			})
			.catch((e) => {
				console.warn(`${this.props.componentId} - beforeValueChange rejected the promise with`, e);
			});
		} else {
			execQuery();
		}
	}

	handleInputChange(event) {
		const inputVal = event.target.value;
		this.setState({
			currentValue: inputVal
		});
		const obj = {
			key: this.props.componentId,
			value: inputVal
		};

		const execQuery = () => {
			if (this.props.onValueChange) {
				this.props.onValueChange(obj.value);
			}
			// pass the selected sensor value with componentId as key,
			const isExecuteQuery = true;
			helper.URLParams.update(this.props.componentId, inputVal, this.props.URLParams);
			helper.selectedSensor.set(obj, isExecuteQuery);
		};

		if (this.props.beforeValueChange) {
			this.props.beforeValueChange(obj.value)
			.then(() => {
				execQuery();
			})
			.catch((e) => {
				console.warn(`${this.props.componentId} - beforeValueChange rejected the promise with`, e);
			});
		} else {
			execQuery();
		}
	}

	handleBlur(event, { highlightedSuggestion }) {
		if (!highlightedSuggestion || !highlightedSuggestion.label) {
			this.handleSearch({
				value: this.state.currentValue
			});
		}
	}

	handleKeyPress(event) {
		if (event.key === "Enter") {
			event.target.blur();
		}
	}

	onInputChange(event, { method, newValue }) {
		if (method === "type") {
			this.setValue(newValue);
		}
	}

	onSuggestionSelected(event, { suggestion }) {
		this.handleSearch(suggestion);
	}

	getSuggestionValue(suggestion) {
		return suggestion.label.innerText || suggestion.label;
	}

	renderSuggestion(suggestion) {
		return <span>{suggestion.label}</span>
	}

	render() {
		let title = null;
		if (this.props.title) {
			title = (<h4 className="rbc-title col s12 col-xs-12">{this.props.title}</h4>);
		}
		const cx = classNames({
			"rbc-title-active": this.props.title,
			"rbc-title-inactive": !this.props.title,
			"rbc-placeholder-active": this.props.placeholder,
			"rbc-placeholder-inactive": !this.props.placeholder,
			"rbc-autoSuggest-active": this.props.autoSuggest,
			"rbc-autoSuggest-inactive": !this.props.autoSuggest
		});

		const options = this.state.currentValue === "" || this.state.currentValue === null
							? this.props.initialSuggestions && this.props.initialSuggestions.length
							? this.props.initialSuggestions
							: []
							: this.state.options;

		return (
			<div className={`rbc rbc-datasearch col s12 col-xs-12 card thumbnail ${cx} ${this.state.isLoadingOptions ? "is-loading" : ""}`} style={this.props.componentStyle}>
				{title}
				{
					this.props.autoSuggest ?
						<Autosuggest
							suggestions={options}
							onSuggestionsFetchRequested={() => {}}
							onSuggestionsClearRequested={() => {}}
							onSuggestionSelected={this.onSuggestionSelected}
							getSuggestionValue={this.getSuggestionValue}
							renderSuggestion={this.renderSuggestion}
							shouldRenderSuggestions={() => true}
							focusInputOnSuggestionClick={false}
							inputProps={{
								placeholder: this.props.placeholder,
								value: this.state.currentValue === null ? "" : this.state.currentValue,
								onChange: this.onInputChange,
								onBlur: this.handleBlur,
								onKeyPress: this.handleKeyPress
							}}
						/> :
						<div className="rbc-search-container col s12 col-xs-12">
							<input
								type="text"
								className="rbc-input"
								placeholder={this.props.placeholder}
								value={this.state.currentValue ? this.state.currentValue : ""}
								onChange={this.handleInputChange}
							/>
						</div>
				}
			</div>
		);
	}
}

DataSearch.propTypes = {
	componentId: React.PropTypes.string.isRequired,
	appbaseField: React.PropTypes.oneOfType([
		React.PropTypes.string,
		React.PropTypes.arrayOf(React.PropTypes.string)
	]),
	weights: React.PropTypes.arrayOf(React.PropTypes.number),
	title: React.PropTypes.oneOfType([
		React.PropTypes.string,
		React.PropTypes.element
	]),
	placeholder: React.PropTypes.string,
	autoSuggest: React.PropTypes.bool,
	defaultSelected: React.PropTypes.string,
	customQuery: React.PropTypes.func,
	onValueChange: React.PropTypes.func,
	beforeValueChange: React.PropTypes.func,
	react: React.PropTypes.object,
	initialSuggestions: React.PropTypes.arrayOf(
		React.PropTypes.shape({
			label: React.PropTypes.oneOfType([
				React.PropTypes.string,
				React.PropTypes.element
			]),
			value: React.PropTypes.string
		})
	),
	componentStyle: React.PropTypes.object,
	highlight: React.PropTypes.bool,
	highlightField: React.PropTypes.oneOfType([
		React.PropTypes.string,
		React.PropTypes.arrayOf(React.PropTypes.string)
	]),
	URLParams: React.PropTypes.bool,
	showFilter: React.PropTypes.bool,
	filterLabel: React.PropTypes.string,
	queryFormat: React.PropTypes.oneOf(["and", "or"]),
	fuzziness: React.PropTypes.oneOfType([
		React.PropTypes.string,
		React.PropTypes.number,
	])
};

// Default props value
DataSearch.defaultProps = {
	placeholder: "Search",
	autoSuggest: true,
	componentStyle: {},
	highlight: false,
	URLParams: false,
	showFilter: true,
	queryFormat: "or"
};

// context type
DataSearch.contextTypes = {
	appbaseRef: React.PropTypes.any.isRequired,
	type: React.PropTypes.any.isRequired,
	reactiveId: React.PropTypes.number
};

DataSearch.types = {
	componentId: TYPES.STRING,
	appbaseField: TYPES.STRING,
	appbaseFieldType: TYPES.STRING,
	react: TYPES.OBJECT,
	title: TYPES.STRING,
	placeholder: TYPES.STRING,
	autoSuggest: TYPES.BOOLEAN,
	defaultSelected: TYPES.STRING,
	customQuery: TYPES.FUNCTION,
	componentStyle: TYPES.OBJECT,
	highlight: TYPES.BOOLEAN,
	highlightField: TYPES.STRING,
	URLParams: TYPES.BOOLEAN,
	showFilter: TYPES.BOOLEAN,
	filterLabel: TYPES.STRING,
	weights: TYPES.ARRAY,
	queryFormat: TYPES.STRING,
	fuzziness: TYPES.NUMBER
};
