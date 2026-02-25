/**
 * Hermes polyfill - fix __FUSEBOX_REACT_DEVTOOLS_DISPATCHER__ crash.
 * Log ALL defineProperty errors to find if we're swallowing something.
 */
var _origDefProp = Object.defineProperty;
var _swallowedCount = 0;
Object.defineProperty = function(obj, prop, descriptor) {
  try {
    return _origDefProp.call(Object, obj, prop, descriptor);
  } catch (e) {
    if (e instanceof TypeError && 
        typeof prop === 'string' && 
        prop.indexOf('__FUSEBOX') === 0) {
      _swallowedCount++;
      return obj;
    }
    // Log ANY other defineProperty errors
    console.error('[hermes-polyfill] NON-FUSEBOX defineProperty error:', prop, e.message);
    throw e;
  }
};
