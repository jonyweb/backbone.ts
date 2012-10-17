/// <reference path="jQuery.d.ts" />
/// <reference path="underscore.d.ts" />

//     Backbone.ts 0.1
//     (c) 2012 Josh Baldwin
//     Backbone.ts may be freely distributed under the MIT license.
//     For all details and documentation:
//     https://github.com/jbaldwin/backbone.ts

/**
* Backbone.ts Module
**/
module Backbone {

	// Backbone.ts version.
	export var Version = "0.1";

	// Handle to the root window.
	export var root: Window = window;

	// Handle to jQuery.
	export var $ = jQuery;

	// Handle to underscore.
	export var _: underscore = (<any>root)._;

	// Map from CRUD to HTTP for our default `Backbone.sync` implementation.
	export var MethodType = {
		CREATE: 'POST',
		UPDATE: 'PUT',
		DELETE: 'DELETE',
		READ: 'GET'
	};

	// Override this function to change the manner in which Backbone persists
	// models to the server. You will be passed the type of request, and the
	// model in question. By default, makes a RESTful Ajax request
	// to the model's `url()`. Some possible customizations could be:
	export function sync(method: string, model: Model, settings?: JQueryAjaxSettings) {

		settings || (settings = {});

		// Default JSON-request options.
		var params: JQueryAjaxSettings = { 
			type: method, 
			dataType: 'json', 
			url: model.url,
		};

		// Ensure that we have the appropriate request data.
		if (model && (method === MethodType.CREATE || method === MethodType.UPDATE)) {
			params.contentType = 'application/json';
			params.data = JSON.stringify(model.toJSON());
		}

		// Don't process data on a non-GET request.
		if (params.type !== 'GET') {
			params.processData = false;
		}

		// Make the request, allowing the user to override any Ajax options.
		return $.ajax(_.extend(params, settings));
	};

	// Wrap an optional error callback with a fallback error event.
	function wrapError(onError, originalModel, options) {
		return function (model, resp) {
			resp = model === originalModel ? resp : model;
			if (onError) {
				onError(originalModel, resp, options);
			} else {
				originalModel.trigger('error', originalModel, resp, options);
			}
		};
	};

	/**
	* IEventHandler
	* Turn on/off and trigger events through a callback functions.
	* Can have multiple callbacks per event.
	**/
	interface IEventHandler {

		/**
		* Turns on or adds a callback function to the event.
		* If the event does not exist it is added and turned on with
		* the callback function.
		* If the event already exists the callback function is added.
		* event: The name of the event.
		* fn: Callback function.
		* context: The 'this' argument when triggering the event, defaults to the callee.
		**/
		on(event: string, fn: Function, context?: any): void;

		/**
		* Turns off or removes a callback function from the event.
		* fn is optional, if provided only that callback function is removed
		* from the event.  If fn is not provided then all callback functions
		* are removed from the event.
		**/
		off(event: string, fn?: Function): void;

		/**
		* Triggers all callback functions linked to the event with
		* the supplied arguments list.
		*
		* note: do not like how the argument list cannot be statically checked
		*       not sure how to get around this so leaving as any[]
		**/
		trigger(event: string, ...args: any[]): void;

		/**
		* Clears all events and their callback functions.
		**/
		clear(): void;
	}

	export class Events implements IEventHandler {

		/**
		* Internal structure to hold all callbacks along with their context.
		*
		* Each event is keyed by name.
		* Each event can have many callbacks, each keyed by an index.
		* Each callback can have a different context, by default 'window' is used
		* as the context if no context is provided.
		*
		* Dictionary<string, Event>:
		*       Dictionary<string, Tuple<Function, context>>
		**/
		private _callbacks: {
			[event: string]: { 
				[id: string]: {
					fn: Function;
					context: any;
				};
			};
		};

		constructor () {
			this.clear();
		}

		public on(event: string, fn: Function, context?: any): void {

			var id = Backbone._.uniqueId("callback_");
			// Create the event holder.
			if (this._callbacks[event] === undefined) {
				console.log("Events.on() creating event " + event);
				this._callbacks[event] = { };
			}

			if (this._callbacks[event][id] === undefined) {
				this._callbacks[event][id] = { fn: fn, context: (context || this) };
			} else {
				this._callbacks[event][id].fn = fn;
				this._callbacks[event][id].context = (context || this);
			}
		}
		
		public off(event: string, fn?: Function): void {
		
			if (this._callbacks[event] !== undefined) {
				if (fn !== undefined) {
					for (var id in this._callbacks[event]) {
						if (fn === this._callbacks[event][id].fn) {
							delete this._callbacks[event][id];
						}
					}

					// Remove event callback entirely if it is empty
					if ($.isEmptyObject(this._callbacks[event])) {
						delete this._callbacks[event];
					}
				} else {
					// Remove all events.
					delete this._callbacks[event];
				}
			}
		}

		public trigger(event: string, ...args: any[]): void {

			if (this._callbacks[event] !== undefined) {
				for (var key in this._callbacks[event]) {
					this._callbacks[event][key].fn.apply(
						this._callbacks[event][key].context,
						args);
				}
			}
		}

		public clear(): void {
			this._callbacks = {};
		}
	}

	export class Event {

		constructor ( 
			public fn: (e: JQueryEventObject) => JQuery, 
			public event: string,
			public selector?: string = undefined) {
		}
	}

	export class View extends Events {

		/**
		* User defined id for the view.
		**/
		public id: string;

		/**
		* Backbone defined cid for the view.
		* Format is "view_{number}".
		**/
		public cid: string;

		/**
		* The element, must be provided to the View.
		* May or may not be attached to the DOM, must be manually attached.
		**/
		public el: HTMLElement;

		/**
		* jQuery reference to the element provided.
		**/
		public $el: JQuery;

		/**
		* The instance of the model associated with this view.
		* Can be undefined when using a Collection.
		* Can be undefined when the view does not save or manipulate data.
		**/
		public model: Model;

		public collection: any; // todo implement Collection

		// redundant? force user to pass in element
		public className: string;

		// redundant? force user to pass in element
		public tagName: string;

		// redundant? force user to pass in element
		public attributes: any;

		public domEvents: {
			[event: string]: Event;
		};

		constructor (
			id: string,
			el: HTMLElement, 
			model?: Model = undefined,
			events?: Event[] = new Event[]) {
			
			super();

			this.id = id;
			this.cid = _.uniqueId('view_');
			this.model = model;
			this.domEvents = {};
			for (var i = 0; i < events.length; i++) {
				this.domEvents[events[i].event] = events[i];
			}

			this.setElement(el, true);
		}

		/** jQuery delegate for element lookup, scoped to DOM elements within the
		* current view.  This should be preferred to global lookups where possible.
		* selector: jQuery selector
		* returns jQuery lookup
		**/
		public $(selector): JQuery {
			return this.$el.find(selector);
		}

		public render(): View {
			return this;
		}

		/**
		* Removes the View from the DOM.
		* Side effects includes undelegeting events, use detach to keep
		* events intact.
		**/
		public remove(): View {
			this.$el.remove();
			return this;
		}

		/**
		* Detaches the View from the DOM.
		* Delegates to $.detach, preserving jQuery data and events.  This
		* is the preferred method if you plan on re-using the View.
		**/
		public detach(): View {
			this.$el.detach();
			return this;
		}

		/**
		* Set the View's element (`this.el` property), by default
		* re-delegates all events.
		**/
		public setElement(el: HTMLElement, delegate?: bool = true): View {
			if(this.$el)
				this.undelegateEvents();

			this.$el = $(el);
			this.el = this.$el[0];

			if(delegate !== false)
				this.delegateEvents();

			return this;
		}

		public delegateEvents(): void {
			if(_.isEmpty(this.domEvents))
				return;

			this.undelegateEvents();
			for (var key in this.domEvents) {
				
				// Bind the function to this View for context.
				var func = _.bind(this.domEvents[key].fn, this);
				var eventName = this.domEvents[key].event + '.delegateEvents' + this.cid;

				if (this.domEvents[key].selector === undefined) {
					this.$el.on(
						eventName,
						func);
				} else {
					this.$el.delegate(
						this.domEvents[key].selector,
						eventName,
						<any>func);
				}
				
			}
		}

		public undelegateEvents() {
			this.$el.off('.delegateEvents' + this.cid);
		}
	}

	export class SetOptions {
		
		constructor (
			public silent?: bool = false,
			public unset?: bool = false,
			public changes?: any = {}
			) {

		}
	}

	export class Model extends Events {

		public id: string;

		private cid: string;

		public idAttribute: string = 'id';

		public url: string;

		public attributes: any;

		public changed: any = {};

		private _silent: any = {};

		private _pending: any = {};

		private _previousAttributes: any = {};

		private _escapedAttributes: any = {};

		private _changing: bool = false;

		public sync = Backbone.sync;

		constructor (
			id: string,
			attributes: any = {},) {
			super();

			this.id = id;
			this.cid = _.uniqueId('c');

			this.attributes = attributes;
			this._previousAttributes = _.clone(this.attributes);
		}

		public toJSON(): any {
			return _.clone(this.attributes);
		}

		public has(attribute: string): any {
			return this.get(attribute) != null;
		}

		public get(attribute: string): any {
			return this.attributes[attribute];
		}

		public escape(attribute: string): any {
			var html;
			if(html = this._escapedAttributes[attribute])
				return html;
			var val = this.get(attribute);
			return this._escapedAttributes[attribute] = _.escape(val == null ? '' : '' + val);
		}

		public set(
			key: any, 
			value?: any, 
			options?: SetOptions = new SetOptions()): bool {
			
			var attrs, attr, val;

			// Handle both `"key", value` and `{key: value}` -style arguments.
			if (_.isObject(key) || key == null) {
				attrs = key;
			} else {
				attrs = {};
				attrs[key] = value;
			}

			// Extract attributes and options.
			if (!attrs) 
				return false;
			if (attrs instanceof Model) 
				attrs = (<Model>attrs).attributes;
			if (options.unset)
				for (attr in attrs)
					attrs[attr] = void 0;

			// Run validation.
			if (!this._validate(attrs)) 
				return false;

			// Check for changes of `id`.
			if (this.idAttribute in attrs) 
				this.id = attrs[this.idAttribute];

			var changes = options.changes = {};
			var now = this.attributes;
			var escaped = this._escapedAttributes;
			var prev = this._previousAttributes || {};

			// For each `set` attribute...
			for (attr in attrs) {
				val = attrs[attr];

				// If the new and current value differ, record the change.
				if (!_.isEqual(now[attr], val) || (options.unset && _.has(now, attr))) {
					delete escaped[attr];
					(options.silent ? this._silent : changes)[attr] = true;
				}

				// Update or delete the current value.
				options.unset ? delete now[attr] : now[attr] = val;

				// If the new and previous value differ, record the change.  If not,
				// then remove changes for this attribute.
				if (!_.isEqual(prev[attr], val) || (_.has(now, attr) != _.has(prev, attr))) {
					this.changed[attr] = val;
					if (!options.silent) this._pending[attr] = true;
				} else {
					delete this.changed[attr];
					delete this._pending[attr];
				}
			}

			// Fire the `"change"` events.
			if (!options.silent) 
				this.change();
			return true;
		}

		public unset(key: any, options: SetOptions): bool {
			options.unset = true;
			return this.set(key, null, options);
		}

		public clear(silent: bool = false) {
			return this.unset(_.clone(this.attributes), <SetOptions>{ unset: true });
		}

		public fetch(settings?: JQueryAjaxSettings) {
			settings = settings ? _.clone(settings) : {};
			var success = settings.success;
			settings.success = (resp, status, xhr) => {
				if (!this.set(this.parse(resp, xhr), settings)) 
					return false;
				if (success) 
					(<Function>success)(this, resp);
			}
			settings.error = wrapError(settings.error, this, settings);
			return (this.sync || Backbone.sync).call(
				this, 
				Backbone.MethodType.READ, 
				this, 
				settings);
		}

		// Set a hash of model attributes, and sync the model to the server.
		// If the server returns an attributes hash that differs, the model's
		// state will be `set` again.
		public save(key, value, options?): any {
			var attrs, current;

			// Handle both `("key", value)` and `({key: value})` -style calls.
			if (_.isObject(key) || key == null) {
				attrs = key;
				options = value;
			} else {
				attrs = {};
				attrs[key] = value;
			}
			options = options ? _.clone(options) : {};

			// If we're "wait"-ing to set changed attributes, validate early.
			if (options.wait) {
				if (!this._validate(attrs, options)) return false;
				current = _.clone(this.attributes);
			}

			// Regular saves `set` attributes before persisting to the server.
			var silentOptions = _.extend({}, options, { silent: true });
			if (attrs && !this.set(attrs, options.wait ? silentOptions : options)) {
				return false;
			}

			// After a successful server-side save, the client is (optionally)
			// updated with the server-side state.
			//var model = this;
			var success = options.success;
			options.success = (resp, status, xhr) => {
				var serverAttrs = this.parse(resp, xhr);
				if (options.wait) {
					delete options.wait;
					serverAttrs = _.extend(attrs || {}, serverAttrs);
				}
				if (!this.set(serverAttrs, options)) return false;
				if (success) {
					success(this, resp);
				} else {
					this.trigger('sync', this, resp, options);
				}
			};

			// Finish configuring and sending the Ajax request.
			options.error = wrapError(options.error, this, options);
			var method = this.isNew() ? 'create' : 'update';
			var xhr = (this.sync || Backbone.sync).call(this, method, this, options);
			if (options.wait) this.set(current, silentOptions);
			return xhr;
		}

		public change() {

		}

		public validate(key: any, value?: any): bool {
			return true;
		}

		private _validate(key: any, value?: any): bool {

			return true;
		}

	}
}