(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(factory());
}(this, (function () { 'use strict';

var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
};



































var toConsumableArray = function (arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

    return arr2;
  } else {
    return Array.from(arr);
  }
};

var _require = require('lodash');
var omit = _require.omit;
var template = _require.template;
var forEach = _require.forEach;
var clamp = _require.clamp;
var reduce = _require.reduce;
var _require2 = require('savnac-utils');
var htmlToElement = _require2.htmlToElement;
var empty = _require2.empty;

// TODO: should probably change the element being passed back in the callbacks
// from the btn to the select element for consistency and markup predictability

var DEFAULT_OPTS = {
  selectEl: undefined,
  btnLabel: 'Button',
  btnMarkup: '<button><%- btnText %></button>',
  optionMarkup: '<li><%- option %></li>',
  ulMarkup: '<ul></ul>',
  // callback when focus is brought to the select
  onFocus: function onFocus(element) {
    console.log('button focus', element);
  },

  // when the select is blurred/navigated away from
  onBlur: function onBlur(element) {
    console.log('button blur', element);
  },

  // when the selected value changes
  onChange: function onChange(element) {
    var values = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { prevValue: 0, nextValue: 1 };
    console.log('select change', element, values);
  },

  // callback for when the disabled state of the select changes
  onEnabledChange: function onEnabledChange(element, isEnabled) {
    console.log('enabled state change', element, isEnabled);
  }
};

var customSelect = function customSelect() {
  var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  var omittedKeys = ['btnMarkup', 'optionMarkup', 'ulMarkup'];

  var props = _extends({
    isEnabled: false,
    // selects get disabled at the start if necessary and triggers callback correctly
    selectEnabled: true,
    isFocused: false,
    btnTemplate: template(optsOrDefault('btnMarkup')),
    optionTemplate: template(optsOrDefault('optionMarkup')),
    ulMarkup: optsOrDefault('ulMarkup'),
    currentModifierKeys: [],
    optionValues: [],
    current: {
      letter: '',
      count: 0,
      index: -1
    },
    notOnPage: false,
    measurements: {}
  }, omit(DEFAULT_OPTS, omittedKeys), omit(opts, omittedKeys));

  var els = {};
  var cbs = {};

  var modifierKeys = ['Meta', 'Alt', 'Control', 'Shift', 'Enter'];

  var updaters = {
    options: updateOptions
  };

  function optsOrDefault(key) {
    return opts[key] || DEFAULT_OPTS[key];
  }

  var createChildren = function createChildren() {
    els.select = props.selectEl;

    if (!els.select) {
      props.notOnPage = true;
      console.info('Provided select element not defined. Preventing CustomSelect enable.');
      return;
    }

    els.selectOptions = els.select.querySelectorAll('option');
    els.selectWrapper = els.select.parentElement;
  };

  var generateMarkup = function generateMarkup() {
    els.btn = htmlToElement(props.btnTemplate({ btnText: props.btnLabel }));
    els.selectWrapper.appendChild(els.btn);

    els.ul = htmlToElement(props.ulMarkup);
    els.selectWrapper.appendChild(els.ul);

    forEach(els.selectOptions, function (option) {
      els.ul.appendChild(htmlToElement(props.optionTemplate({ option: option.value })));
      props.optionValues.push(option.value);
    });

    els.ulChildren = els.ul.children;

    setSelectEnabled();
  };

  var getMeasurements = function getMeasurements() {
    props.measurements = {
      ulHeight: els.ul.offsetHeight,
      liHeight: els.ulChildren.length > 0 ? els.ulChildren[0].offsetHeight : 0
    };
  };

  var onFocus = function onFocus(e) {
    if (!props.selectEnabled || props.isFocused) return;

    props.isFocused = true;

    props.focusTimeStamp = e.timeStamp;
    setUlVisibility(true, getMeasurements);
    props.onFocus(e.currentTarget);
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
    window.addEventListener('click', onWindowClick);
  };

  var setUlVisibility = function setUlVisibility(isVisible) {
    var complete = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {};

    Velocity(els.ul, isVisible ? 'slideDown' : 'slideUp', { complete: complete, duration: 300 });
  };

  var onLiClick = function onLiClick(i) {
    return function () {
      return setSelectedIndex(i);
    };
  };

  var onWindowClick = function onWindowClick(e) {
    if (e.timeStamp - props.focusTimeStamp > 200) {
      blurInput();
    }
  };

  var blurInput = function blurInput() {
    props.currentModifierKeys = [];
    setUlVisibility(false);
    props.onBlur(els.btn);
    window.removeEventListener('keydown', onKeydown);
    window.removeEventListener('keyup', onKeyup);
    window.removeEventListener('click', onWindowClick);

    props.isFocused = false;
  };

  var indexBounds = function indexBounds(nextIndex) {
    return clamp(nextIndex, 0, els.selectOptions.length - 1);
  };

  var moveAdjacent = function moveAdjacent(inc) {
    var change = inc ? 1 : -1;
    setSelectedIndex(indexBounds(els.select.selectedIndex + change));
  };

  var setItem = function setItem(active) {
    return function (index) {
      var item = els.ulChildren[index];
      if (!item) return;

      var method = active ? 'add' : 'remove';
      var attributeMethod = active ? 'setAttribute' : 'removeAttribute';

      item.classList[method]('is-selected');
      els.select.children[index][attributeMethod]('selected', '');

      if (active) {
        // scroll to the focused item if out of view
        var _props$measurements = props.measurements,
            ulHeight = _props$measurements.ulHeight,
            liHeight = _props$measurements.liHeight;

        var top = els.ulChildren[index].offsetTop;
        var scrollTop = els.ul.scrollTop;

        if (top < scrollTop || top >= scrollTop + ulHeight - liHeight) {
          els.ul.scrollTop = top;
        }
      }
    };
  };

  var setItemActive = setItem(true);
  var setItemInactive = setItem(false);

  var setSelectedIndex = function setSelectedIndex(nextIndex) {
    var prevIndex = els.select.selectedIndex;
    if (prevIndex === nextIndex) return;

    setItemInactive(prevIndex);
    setItemActive(nextIndex);

    props.onChange(els.btn, {
      prevIndex: prevIndex,
      nextIndex: nextIndex
    });

    els.select.selectedIndex = nextIndex;
  };

  var setSelectEnabled = function setSelectEnabled() {
    // run through all conditions to satisfy whether the select should be enabled
    // currently only cares if there are items to select
    var shouldBeEnabled = els.ulChildren.length > 0;

    if (props.selectEnabled !== shouldBeEnabled) {
      props.selectEnabled = shouldBeEnabled;
      var method = props.selectEnabled ? 'removeAttribute' : 'setAttribute';
      els.select[method]('disabled', '');
      els.btn[method]('disabled', '');
      props.onEnabledChange(els.btn, props.selectEnabled);
    }
  };

  var onKeydown = function onKeydown(e) {
    var key = e.key;


    if (modifierKeys.includes(key)) {
      props.currentModifierKeys.push(key);
    }

    if (key === 'Tab') {
      blurInput();
      return;
    }

    if (props.currentModifierKeys.length > 0) {
      // allows other keyboard shortcuts such as refreshing the page
      return;
    } else {
      // prevents window scrolling with arrows
      e.preventDefault();
    }

    switch (key) {
      case 'ArrowUp':
        moveAdjacent(false);
        return;
      case 'ArrowDown':
        moveAdjacent(true);
        return;
    }

    if (key.length === 1 && key.match(/[a-zA-Z0-9]/)) {
      if (key === props.current.letter) {
        props.current.count++;
      } else {
        props.current.count = 0;

        var itemIndex = props.optionValues.reduce(function (a, c, i) {
          if (a >= 0) return a;
          return c.charAt(0).toLowerCase() >= key.toLowerCase() ? i : -1;
        }, -1);

        props.current.index = itemIndex < 0 ? props.optionValues.length - 1 : itemIndex;
        props.current.letter = key;
      }

      setSelectedIndex(indexBounds(props.current.index + props.current.count));
    }
  };

  var onKeyup = function onKeyup(_ref) {
    var key = _ref.key;

    var removeIndex = props.currentModifierKeys.indexOf(key);
    if (removeIndex < 0) return;

    props.currentModifierKeys = [].concat(toConsumableArray(props.currentModifierKeys.slice(0, removeIndex)), toConsumableArray(props.currentModifierKeys.slice(removeIndex + 1)));
  };

  var setDefaultSelected = function setDefaultSelected() {
    var selectedIndex = els.select.selectedIndex;


    var index = reduce(els.selectOptions, function (a, c, i) {
      if (a > -1) return a;
      return c.getAttribute('selected') ? i : a;
    }, -1);

    setSelectedIndex(index);
  };

  // currently is only handling for updating the options (options being the list of items in the select)
  // add handlers to updaters to extend functionality
  var updateSelect = function updateSelect() {
    var changes = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    for (var k in changes) {
      if (changes.hasOwnProperty(k) && updaters.hasOwnProperty(k)) {
        updaters[k](changes[k]);
      }
    }
  };

  function updateOptions(newOptions) {
    if (!props.isEnabled) return;

    forEach(els.ulChildren, function (li, i) {
      li.removeEventListener('click', cbs['onLiClick-' + i]);
    });

    cbs = {};

    empty(els.select);
    empty(els.ul);

    var temp = template('<option value="<%- val %>"><%- val %></option>');
    newOptions.forEach(function (val) {
      els.select.appendChild(htmlToElement(temp({ val: val })));
      els.ul.appendChild(htmlToElement(props.optionTemplate({ option: val })));
    });

    props.optionValues = newOptions;

    els.selectOptions = els.select.querySelectorAll('option');
    els.ulChildren = els.ul.children;

    forEach(els.ulChildren, function (li, i) {
      cbs['onLiClick-' + i] = onLiClick(i);
      li.addEventListener('click', cbs['onLiClick-' + i]);
    });

    setDefaultSelected();
    setSelectEnabled();
  }

  var clear = function clear() {
    return setSelectedIndex(-1);
  };

  var removeGeneratedMarkup = function removeGeneratedMarkup() {
    var wrapper = els.btn.parentNode;
    wrapper.removeChild(els.btn);
    wrapper.removeChild(els.ul);
  };

  var init = function init() {
    createChildren();

    if (props.notOnPage) return;

    generateMarkup();
    getMeasurements();
    setDefaultSelected();
  };

  var enable = function enable(toEnable) {
    return function () {
      if (toEnable === props.isEnabled || props.notOnPage) return;

      var e = toEnable ? 'add' : 'remove';

      els.btn[e + 'EventListener']('click', onFocus);
      els.btn[e + 'EventListener']('focus', onFocus);

      forEach(els.ulChildren, function (li, i) {
        cbs['onLiClick-' + i] = onLiClick(i);
        li[e + 'EventListener']('click', cbs['onLiClick-' + i]);
      });

      if (!toEnable) removeGeneratedMarkup();

      props.isEnabled = toEnable;
    };
  };

  return {
    init: init,
    updateSelect: updateSelect,
    clear: clear,
    enable: enable(true),
    disable: enable(false)
  };
};

module.exports = customSelect;

})));
