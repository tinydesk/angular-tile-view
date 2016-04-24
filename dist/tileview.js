(function () {
    'use strict';
    var mod = angular.module('td.tileview', []);
    /**
       * @ngdoc directive
       * @name td.tileview.directive:tdTileview
       * @restrict E
       *
       * @description
       *
       * The tile directive provides a tile-based view on a list of data. The tiles can be arranged in a grid or they can be
       * horizontally stacked.
     *
     * The tile directive will automatically resize when the window is resized. If the size changed for some other reasons, a manual resize
     * can be triggered, by broadcasting the `td.tileview.resize` event.
       *
       * @param {Array=} items The items that are to be displayed in the tile view
     * @param {string=} scrollEnd An expression that gets evaluated when the user scrolls to the end of the data.
       * @param {object=} options An options object defining options that are relevant specifically for the tile ui such as
       * tile sizes for example. It consists of the following properties:
       *
       * - **templateUrl** - {string} - Path to the template that should be used to render tiles. The template will implicitly have
       * access to the tile directive's scope plus an `item` object. Note that the template is responsible for maintaining the
       * selection state by calling the appropriate methods on the selection object.
       * - **tileSize** - {object} - The current tile size represented as an object with the following properties:
       *   - **width** - {int} - The width of the tile.
       *   - **height** - {int} - The height of the tile.
       * Can be dynamically adjusted.
       * - **alignHorizontal** - {boolean} - Whether to show the tiles in a grid with a vertical scrollbar or horizontally
       * stacked.
     * - **scrollEndOffset** - {number} - Some features that rely on the `scrollEnd` callback need to be informed in advance.
     * This property specifies an offset in rows to trigger the scroll end event before actually hitting the bottom of the data. **Default**: 0
     * - **overflow** - {number} - Number of rows that are rendered additionally to the visible rows to make the scrolling experience more fluent. **Default**: 2
       */
    mod.directive('tdTileview', ['$compile', '$templateCache', '$window', function TileView($compile, $templateCache, $window) {
            return {
                restrict: 'E',
                scope: {
                    items: '=',
                    options: '=',
                    scrollEnd: '&'
                },
                templateUrl: 'tileview.tpl.html',
                link: function (scope, elem, attrs) {
                    scope.elem = elem;
                    scope.tileStyle = {};
                    scope.tileStyle.marginRight = "4px";
                    scope.tileStyle.marginBottom = "4px";
                    scope.tileStyle.float = "left";
                    var container = elem.children();
                    var placeholderStart = container.children().eq(0);
                    var itemContainer = container.children().eq(1);
                    var placeholderEnd = container.children().eq(2);
                    var linkFunction = $compile($templateCache.get(scope.options.templateUrl));
                    var heightStart = 0;
                    var heightEnd = 0;
                    var startRow = 0, endRow;
                    var itemsPerRow;
                    var rowCount;
                    var cachedRowCount;
                    scope.$watch('options', function () {
                        scope.options.scrollEndOffset = def(scope.options.scrollEndOffset, 0);
                        scope.options.overflow = def(scope.options.overflow, 2);
                    });
                    scope.$watch('items', layout);
                    scope.$on('td.tileview.resize', layout);
                    scope.$watchGroup(['options.tileSize.width', 'options.tileSize.height'], function () {
                        layout();
                        forEachElement(function (el, i) {
                            el.css('height', scope.options.tileSize.height + 'px');
                            el.css('width', scope.options.tileSize.width + 'px');
                        });
                    });
                    angular.element($window).on('resize', onResize);
                    scope.$on('$destroy', function () {
                        angular.element($window).off('resize', onResize);
                    });
                    function forEachElement(fn) {
                        for (var i = 0; i < itemElementCount(); ++i) {
                            fn(itemContainer.children().eq(i), i);
                        }
                    }
                    function itemElementCount() {
                        return itemContainer.children().length;
                    }
                    var lastScrollPosition = 0;
                    function updateVisibleRows() {
                        function clamp(value, min, max) {
                            return Math.max(Math.min(value, max), min);
                        }
                        var rect = elem[0].getBoundingClientRect();
                        var itemHeight = scope.options.tileSize.height;
                        var maxScrollPosition = rowCount * itemHeight - rect.height;
                        container[0].scrollTop = clamp(container[0].scrollTop, 0, maxScrollPosition);
                        var scrollPosition = container[0].scrollTop;
                        var scrollEndThreshold = maxScrollPosition - scope.options.scrollEndOffset * itemHeight;
                        if (scrollPosition >= scrollEndThreshold && !(lastScrollPosition >= scrollEndThreshold) && scope.scrollEnd !== undefined) {
                            scope.scrollEnd();
                        }
                        startRow = clamp(Math.floor(scrollPosition / itemHeight), 0, rowCount - cachedRowCount);
                        endRow = startRow + cachedRowCount;
                        lastScrollPosition = scrollPosition;
                    }
                    function updateItem(elem, item, digest) {
                        if (item !== undefined) {
                            if (elem.css('display') === 'none') {
                                elem.css('display', 'inline-block');
                            }
                            var itemScope = elem.scope();
                            itemScope.item = item;
                            if (digest === true) {
                                itemScope.$digest();
                            }
                        }
                        else {
                            elem.css('display', 'none');
                        }
                    }
                    function setPlaceholder() {
                        heightStart = Math.max(startRow * scope.options.tileSize.height, 0);
                        heightEnd = Math.max((rowCount - endRow) * scope.options.tileSize.height, 0);
                        placeholderStart.css('height', heightStart + 'px');
                        placeholderEnd.css('height', heightEnd + 'px');
                    }
                    function createElements(diff) {
                        updateVisibleRows();
                        if (diff > 0) {
                            // add additional cells:
                            for (var i = 0; i < diff; ++i) {
                                var itemScope = scope.$new();
                                linkFunction(itemScope, function (clonedElement) {
                                    clonedElement.css({
                                        width: scope.options.tileSize.width + 'px',
                                        height: scope.options.tileSize.height + 'px',
                                        display: 'inline-block',
                                        'vertical-align': 'top'
                                    });
                                    itemContainer.append(clonedElement);
                                });
                            }
                        }
                        else if (diff < 0) {
                            // remove cells that are not longer needed:
                            while (diff++ < 0) {
                                itemContainer.children().eq(-1).remove();
                            }
                        }
                        var startIndex = startRow * itemsPerRow;
                        forEachElement(function (el, i) { updateItem(el, scope.items[startIndex + i], false); });
                    }
                    function onResize() {
                        layout();
                        scope.$digest();
                    }
                    function layout() {
                        var itemHeight = scope.options.tileSize.height;
                        var itemWidth = scope.options.tileSize.width;
                        var width = itemContainer[0].getBoundingClientRect().width;
                        var height = elem[0].getBoundingClientRect().height;
                        var oldItemsPerRow = itemsPerRow || 0;
                        var oldCachedRowCount = cachedRowCount || 0;
                        itemsPerRow = Math.floor(width / itemWidth);
                        rowCount = Math.ceil(scope.items.length / itemsPerRow);
                        cachedRowCount = Math.ceil(height / itemHeight) + scope.options.overflow;
                        createElements(itemsPerRow * cachedRowCount - oldItemsPerRow * oldCachedRowCount);
                        setPlaceholder();
                    }
                    function onScroll() {
                        var oldStartRow = startRow;
                        var oldEndRow = endRow;
                        updateVisibleRows();
                        setPlaceholder();
                        var i;
                        if (startRow > oldEndRow || endRow < oldStartRow) {
                            forEachElement(function (el, i) { return updateItem(el, scope.items[startRow * itemsPerRow + i], true); });
                        }
                        else {
                            var intersectionStart = Math.max(startRow, oldStartRow);
                            var intersectionEnd = Math.min(endRow, oldEndRow);
                            var itemElement;
                            var reusedElements;
                            if (endRow > intersectionEnd) {
                                for (i = intersectionEnd * itemsPerRow; i < endRow * itemsPerRow; ++i) {
                                    itemElement = itemContainer.children().eq(0).detach();
                                    updateItem(itemElement, scope.items[i], true);
                                    itemContainer.append(itemElement);
                                }
                            }
                            else if (startRow < intersectionStart) {
                                for (i = intersectionStart * itemsPerRow - 1; i >= startRow * itemsPerRow; --i) {
                                    itemElement = itemContainer.children().eq(-1).detach();
                                    updateItem(itemElement, scope.items[i], true);
                                    itemContainer.prepend(itemElement);
                                }
                            }
                        }
                    }
                    container.on('scroll', onScroll);
                }
            };
        }]);
    // Helper functions:
    function def(value, defaultValue) {
        return (value !== undefined) ? value : defaultValue;
    }
})();

angular.module("td.tileview").run(["$templateCache", function($templateCache) {$templateCache.put("tileview.tpl.html","<div class=\"tile-view\">\n    <div class=\"placeholder-start\">\n\n    </div>\n    <div class=\"item-container\">\n\n    </div>\n    <div class=\"placeholder-end\">\n\n    </div>\n</div>");}]);