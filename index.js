const {omit, template, forEach, clamp, reduce, findIndex, upperFirst} = require('lodash')
const {htmlToElement, empty} = require('savnac-utils')

// TODO: should probably change the element being passed back in the callbacks
// from the btn to the select element for consistency and markup predictability

const DEFAULT_OPTS = {
  selectEl: undefined,
  btnLabel: 'Button',
  btnMarkup: '<button><%- btnText %></button>',
  optionMarkup: '<li><%- option %></li>',
  ulMarkup: '<ul></ul>',
  // callback when focus is brought to the select
  onFocus(element) { console.log('button focus', element) },
  // when the select is blurred/navigated away from
  onBlur(element) { console.log('button blur', element) },
  // when the selected value changes
  onChange(element, values = { prevValue: 0, nextValue: 1 }) { console.log('select change', element, values) },
  // callback for when the disabled state of the select changes
  onEnabledChange(element, isEnabled) { console.log('enabled state change', element, isEnabled)}
}

const customSelect = (opts = {}) => {
  const omittedKeys = ['btnMarkup', 'optionMarkup', 'ulMarkup']

  const props = {
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
    measurements: {},
    ...omit(DEFAULT_OPTS, omittedKeys),
    ...omit(opts, omittedKeys)
  }

  const els = {}
  let cbs = {}

  const modifierKeys = ['Meta', 'Alt', 'Control', 'Shift', 'Enter']

  const updaters = {
    options: updateOptions
  }

  function optsOrDefault(key) {
    return opts[key] || DEFAULT_OPTS[key]
  }

  const createChildren = () => {
    els.select = props.selectEl

    if (!els.select) {
      props.notOnPage = true
      console.info('Provided select element not defined. Preventing CustomSelect enable.')
      return
    }

    els.selectOptions = els.select.querySelectorAll('option')
    els.selectWrapper = els.select.parentElement
  }

  const generateMarkup = () => {
    els.btn = htmlToElement(props.btnTemplate({btnText: props.btnLabel}))
    els.selectWrapper.appendChild(els.btn)

    els.ul = htmlToElement(props.ulMarkup)
    els.selectWrapper.appendChild(els.ul)

    forEach(els.selectOptions, option => {
      els.ul.appendChild(htmlToElement(props.optionTemplate({option: option.value})))
      props.optionValues.push(option.value)
    })

    els.ulChildren = els.ul.children

    setSelectEnabled()
  }

  const getMeasurements = () => {
    props.measurements = {
      ulHeight: els.ul.offsetHeight,
      liHeight: els.ulChildren.length > 0 ? els.ulChildren[0].offsetHeight : 0
    }
  }

  const onFocus = e => {
    if (!props.selectEnabled || props.isFocused) return

    props.isFocused = true

    props.focusTimeStamp = e.timeStamp
    setUlVisibility(true, getMeasurements)
    props.onFocus(e.currentTarget)
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('keyup', onKeyup)
    window.addEventListener('click', onWindowClick)
  }

  const setUlVisibility = (isVisible, complete = () => {}) => {
    Velocity(els.ul, isVisible ? 'slideDown' : 'slideUp', { complete, duration: 300 })
  }

  const onLiClick = i => () => setSelectedIndex(i)

  const onWindowClick = e => {
    if (e.timeStamp - props.focusTimeStamp > 200) {
      blurInput()
    }
  }

  const blurInput = () => {
    props.currentModifierKeys = []
    setUlVisibility(false)
    props.onBlur(els.btn)
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('keyup', onKeyup)
    window.removeEventListener('click', onWindowClick)

    props.isFocused = false
  }

  const indexBounds = nextIndex => clamp(nextIndex, 0, els.selectOptions.length - 1)

  const moveAdjacent = inc => {
    const change = inc ? 1 : -1
    setSelectedIndex(indexBounds(els.select.selectedIndex + change))
  }

  const setItem = active => index => {
    const item = els.ulChildren[index]
    if (!item) return

    const method = active ? 'add' : 'remove'
    const attributeMethod = active ? 'setAttribute' : 'removeAttribute'

    item.classList[method]('is-selected')
    els.select.children[index][attributeMethod]('selected', '')

    if (active) {
      // scroll to the focused item if out of view
      const {ulHeight, liHeight} = props.measurements
      const top = els.ulChildren[index].offsetTop
      const scrollTop = els.ul.scrollTop

      if (top < scrollTop || top >= scrollTop + ulHeight - liHeight) {
        els.ul.scrollTop = top
      }
    }
  }

  const setItemActive = setItem(true)
  const setItemInactive = setItem(false)

  const setSelectedIndex = nextIndex => {
    const prevIndex = els.select.selectedIndex
    if (prevIndex === nextIndex) return

    setItemInactive(prevIndex)
    setItemActive(nextIndex)

    props.onChange(els.btn, {
      prevIndex,
      nextIndex
    })

    els.select.selectedIndex = nextIndex
  }

  const setSelectEnabled = () => {
    // run through all conditions to satisfy whether the select should be enabled
    // currently only cares if there are items to select
    const shouldBeEnabled = els.ulChildren.length > 0

    if (props.selectEnabled !== shouldBeEnabled) {
      props.selectEnabled = shouldBeEnabled
      const method = props.selectEnabled ? 'removeAttribute' : 'setAttribute'
      els.select[method]('disabled', '')
      els.btn[method]('disabled', '')
      props.onEnabledChange(els.btn, props.selectEnabled)
    }
  }

  const onKeydown = e => {
    const {key} = e

    if (modifierKeys.includes(key)) {
      props.currentModifierKeys.push(key)
    }

    if (key === 'Tab') {
      blurInput()
      return
    }

    if (props.currentModifierKeys.length > 0) {
      // allows other keyboard shortcuts such as refreshing the page
      return
    } else {
      // prevents window scrolling with arrows
      e.preventDefault()
    }

    switch (key) {
      case 'ArrowUp':
        moveAdjacent(false)
        return
      case 'ArrowDown':
        moveAdjacent(true)
        return
    }

    if (key.length === 1 && key.match(/[a-zA-Z0-9]/)) {
      if (key === props.current.letter) {
        props.current.count++
      } else {
        props.current.count = 0

        const itemIndex = props.optionValues.reduce((a, c, i) => {
          if (a >= 0) return a
          return c.charAt(0).toLowerCase() >= key.toLowerCase() ? i : -1
        }, -1)

        props.current.index = itemIndex < 0 ? props.optionValues.length - 1 : itemIndex
        props.current.letter = key
      }

      setSelectedIndex(indexBounds(props.current.index + props.current.count))
    }
  }

  const onKeyup = ({key}) => {
    const removeIndex = props.currentModifierKeys.indexOf(key)
    if (removeIndex < 0) return

    props.currentModifierKeys = [
      ...props.currentModifierKeys.slice(0, removeIndex),
      ...props.currentModifierKeys.slice(removeIndex + 1),
    ]
  }

  const setDefaultSelected = () => {
    const {selectedIndex} = els.select

    const index = reduce(els.selectOptions, (a, c, i) => {
      if (a > -1) return a
      return c.getAttribute('selected') ? i : a
    }, -1)

    setSelectedIndex(index)
  }

  // currently is only handling for updating the options (options being the list of items in the select)
  // add handlers to updaters to extend functionality
  const updateSelect = (changes = {}) => {
    for (let k in changes) {
      if (changes.hasOwnProperty(k) && updaters.hasOwnProperty(k)) {
        updaters[k](changes[k])
      }
    }
  }

  function updateOptions(newOptions) {
    if (!props.isEnabled) return

    forEach(els.ulChildren, (li, i) => {
      li.removeEventListener('click', cbs[`onLiClick-${i}`])
    })

    cbs = {}

    empty(els.select)
    empty(els.ul)

    const temp = template('<option value="<%- val %>"><%- val %></option>')
    newOptions.forEach(val => {
      els.select.appendChild(htmlToElement(temp({val})))
      els.ul.appendChild(htmlToElement(props.optionTemplate({option: val})))
    })

    props.optionValues = newOptions

    els.selectOptions = els.select.querySelectorAll('option')
    els.ulChildren = els.ul.children

    forEach(els.ulChildren, (li, i) => {
      cbs[`onLiClick-${i}`] = onLiClick(i)
      li.addEventListener('click', cbs[`onLiClick-${i}`])
    })

    setDefaultSelected()
    setSelectEnabled()
  }

  const clear = () => setSelectedIndex(-1)

  const removeGeneratedMarkup = () => {
    const wrapper = els.btn.parentNode
    wrapper.removeChild(els.btn)
    wrapper.removeChild(els.ul)
  }

  const init = () => {
    createChildren()

    if (props.notOnPage) return

    generateMarkup()
    getMeasurements()
    setDefaultSelected()
  }

  const enable = toEnable => () => {
    if (toEnable === props.isEnabled || props.notOnPage) return

    const e = toEnable ? 'add' : 'remove'

    els.btn[`${e}EventListener`]('click', onFocus)
    els.btn[`${e}EventListener`]('focus', onFocus)

    forEach(els.ulChildren, (li, i) => {
      cbs[`onLiClick-${i}`] = onLiClick(i)
      li[`${e}EventListener`]('click', cbs[`onLiClick-${i}`])
    })

    if (!toEnable) removeGeneratedMarkup()

    props.isEnabled = toEnable
  }

  return {
    init,
    updateSelect,
    clear,
    enable: enable(true),
    disable: enable(false),
  }
}

export default customSelect
