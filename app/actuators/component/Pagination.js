import {default as React, Component} from 'react';
import classNames from 'classnames';
import { manager } from '../../middleware/ChannelManager.js';
var helper = require('../../middleware/helper.js');

export class Pagination extends Component {
	constructor(props, context) {
		super(props);
		this.state = {
			currentValue: 1,
			maxPageNumber: 1
		};
		this.handleChange = this.handleChange.bind(this);
		this.prePage = this.prePage.bind(this);
		this.nextPage = this.nextPage.bind(this);
	}

	// Set query information
	componentDidMount() {
		this.setQueryInfo();
		this.listenGlobal();
	}

	// stop streaming request and remove listener when component will unmount
	componentWillUnmount() {
		if(this.globalListener) {
			this.globalListener.remove();
		}
	}

	// set the query type and input data
	setQueryInfo() {
		let obj = {
			key: this.props.sensorId,
			value: this.state.currentValue
		};
		helper.selectedSensor.setPaginationInfo(obj);
	}

	// listen all results
	listenGlobal() {
		this.globalListener = manager.emitter.addListener('global', function(res) {
			if(res.depends && Object.keys(res.depends).indexOf(this.props.sensorId) > -1) {
				let totalHits = res.channelResponse.data.hits.total;
				let maxPageNumber = Math.ceil(totalHits/res.queryOptions.size) < 1 ? 1 : Math.ceil(totalHits/res.queryOptions.size);
				let size = res.queryOptions.size ? res.queryOptions.size : 20;
				this.setState({
					totalHits: totalHits,
					size: size,
					maxPageNumber: maxPageNumber
				});
			}
		}.bind(this));
	}

	// handle the input change and pass the value inside sensor info
	handleChange(inputVal) {
		this.setState({
			'currentValue': inputVal
		});
		var obj = {
			key: this.props.sensorId,
			value: inputVal
		};

		// pass the selected sensor value with sensorId as key,
		let isExecuteQuery = true;
		helper.selectedSensor.set(obj, isExecuteQuery, 'paginationChange');
	}

	// pre page
	prePage() {
		let currentValue = this.state.currentValue > 1 ? this.state.currentValue - 1 : 1;
		if(this.state.currentValue !== currentValue) {
			this.handleChange.call(this, currentValue);
		}
	}

	// next page
	nextPage() {
		let currentValue = this.state.currentValue < this.state.maxPageNumber ? this.state.currentValue + 1 : this.state.maxPageNumber;
		if(this.state.currentValue !== currentValue) {
			this.handleChange.call(this, currentValue);
		}
	}

	renderPageNumber() {
		let start, numbers = [];
		for(let i = this.state.currentValue; i > 0; i--) {
			if(i%5 === 0 || i === 1) {
				start = i;
				break;
			}
		}
		for(let i = start; i <= start+5; i++) {
			let singleItem = (
				<li key={i} className={(this.state.currentValue === i ? 'active rbc-pagination-active': 'waves-effect')}>
					<a onClick={() => this.handleChange(i)}>{i}</a>
				</li>);
			if(i <= this.state.maxPageNumber) {
				numbers.push(singleItem);
			}
		}
		return (
			<ul className="pagination">
				<li className={(this.state.currentValue === 1 ? 'disabled' : 'waves-effect')}><a onClick={this.prePage}><i className="fa fa-chevron-left"></i></a></li>
				{numbers}
				<li className={(this.state.currentValue === this.state.maxPageNumber ? 'disabled' : 'waves-effect')}><a onClick={this.nextPage}><i className="fa fa-chevron-right"></i></a></li>
			</ul>
		);
	}

	// render
	render() {
		let title = null;
		let titleExists = false;
		if(this.props.title) {
			title = (<h4 className="rbc-title col s12 col-xs-12">{this.props.title}</h4>);
		}

		let cx = classNames({
			'rbc-title-active': this.props.title,
			'rbc-title-inactive': !this.props.title
		});

		return (
			<div className={`rbc rbc-pagination col s12 col-xs-12 card thumbnail ${cx}`}>
				{title}
				<div className="rbc-pagination-component col s12 col-xs-12">
					{this.renderPageNumber()}
				</div>
			</div>
		);
	}
}

Pagination.propTypes = {
	sensorId: React.PropTypes.string.isRequired,
	title: React.PropTypes.string
};

// Default props value
Pagination.defaultProps = {
};

// context type
Pagination.contextTypes = {
	appbaseRef: React.PropTypes.any.isRequired,
	type: React.PropTypes.any.isRequired
};