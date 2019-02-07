// Copyright 2018 Knowledge Expert SA
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Browser } from './browser';
import { Collection } from './collection';
import { Element } from './element';
import { Condition } from './wait';
import { By, WebElement } from 'selenium-webdriver';
import { query } from './queries';
import { ConditionNotMatchedError } from './errors/conditionDoesNotMatchError';
import { lambda } from './helpers';
import { predicate } from './helpers/predicates';

export type ElementCondition = Condition<Element>;
export type CollectionCondition = Condition<Collection>;
export type BrowserCondition = Condition<Browser>;

export namespace condition {

    function conditionFromAsyncQuery<E>(describedPredicate: (entity: E) => Promise<boolean>): Condition<E> {
        return lambda(describedPredicate.toString(), async (entity: E) => {
            if (!await describedPredicate(entity)) {
                throw new ConditionNotMatchedError();
            }
        });
    }

    /**
     * like conditionFromAsyncQuery but with custom description
     * @param {string} description
     * @param {(entity: E) => Promise<boolean>} predicate
     * @returns {Condition<E>}
     */
    function throwIfNot<E>(description: string, predicate: (entity: E) => Promise<boolean>): Condition<E> {
        return lambda(description, async (entity: E) => {
            if (!await predicate(entity)) {
                throw new ConditionNotMatchedError();
            }
        });
    }

    /**
     * Transforms an entity query compared through predicate - to Condition
     * Example: throwIfNotActual(query.element.text, predicate.equals(text))
     */
    function throwIfNotActual<E, A>(query: (entity: E) => Promise<A>, predicate: (actual: A) => boolean): Condition<E> {
        return async (entity: E) => {
            const actual = await query(entity);
            if (!predicate(actual)) {
                throw new Error(`actual ${query}: ${actual}`);
            }
        };
    }

    export namespace element {

        export const isVisible: ElementCondition =
            throwIfNot('is visible', async (element: Element) =>
                (await element.getWebElement()).isDisplayed());

        export const isHidden: ElementCondition =
            Condition.not(isVisible, 'is hidden');

        export const hasVisibleElement = (by: By): ElementCondition =>
            throwIfNot(`has visible element located by ${by}`, async (element: Element) =>
                (await element.element(by).getWebElement()).isDisplayed());

        export const hasAttribute = (name: string): ElementCondition =>
            lambda(`has attribute '${name}'`,
                   throwIfNotActual(query.element.attribute(name), predicate.isTruthy));

        export const isSelected: ElementCondition =
            hasAttribute('elementIsSelected');

        export const isEnabled: ElementCondition =
            throwIfNot('is enabled', async (element: Element) =>
                (await element.getWebElement()).isEnabled());

        export const isDisabled: ElementCondition =
            Condition.not(isEnabled, 'is disabled');

        export const isPresent: ElementCondition =
            throwIfNot('is present', async (element: Element) =>
                !!(await element.getWebElement()));

        export const isAbsent: ElementCondition =
            Condition.not(isPresent, 'is absent');

        export const isFocused: ElementCondition =
            throwIfNot('is focused', async (element: Element) =>
                WebElement.equals(
                    await element.executeScript('return document.activeElement') as WebElement,
                    await element.getWebElement()
                ));

        export const hasText = (expected: string): ElementCondition => // todo: do we need string | number
            lambda(`has text: ${expected}`,
                   throwIfNotActual(query.element.text, predicate.includes(expected)));

        export const hasExactText = (expected: string): ElementCondition => // todo: do we need string | number ?
            lambda(`has exact text: ${expected}`,
                   throwIfNotActual(query.element.text, predicate.equals(expected)));

        export const hasAttributeWithValue = (name: string, value: string): ElementCondition =>
            lambda(`has attribute '${name}' with value '${value}'`,
                   throwIfNotActual(query.element.attribute(name), predicate.equals(value)));


        export const hasAttributeWithValueContaining = (name: string, partialValue: string): ElementCondition =>
            lambda(`has attribute '${name}' with value '${partialValue}'`,
                   throwIfNotActual(query.element.attribute(name), predicate.includes(partialValue)));

        export const hasCssClass = (cssClass: string): ElementCondition =>
            lambda(`has css class '${cssClass}'`,
                   throwIfNotActual(query.element.attribute('class'), predicate.includesWord(cssClass)));
    }

    export namespace collection { // todo: collection vs Collection in collection.ts ?
        export const hasSize = (expected: number): CollectionCondition =>
            lambda(`has size ${expected}`,
                   throwIfNotActual(query.collection.size, predicate.equals(expected)));

        export const hasSizeMoreThan = (size: number): CollectionCondition =>
            lambda(`has size more than ${size}`,
                   throwIfNotActual(query.collection.size, predicate.isMoreThan(size)));

        export const hasSizeLessThan = (size: number): CollectionCondition =>
            lambda(`has size less than ${size}`,
                   throwIfNotActual(query.collection.size, predicate.isLessThan(size)));

        // todo: should we filter collection for visibility before applying this condition?
        export const hasTexts = (texts: string[]): CollectionCondition =>
            lambda(`has texts ${texts}`,
                   throwIfNotActual(query.collection.texts, predicate.equalsByContainsToArray(texts)));

        export const hasExactTexts = (texts: string[]): CollectionCondition =>
            lambda(`has exact texts ${texts}`,
                   throwIfNotActual(query.collection.texts, predicate.equalsByContainsToArray(texts)));
    }

    export namespace browser {
        export const hasUrlContaining = (partialUrl: string): BrowserCondition => // todo: do we need string | number
            lambda(`has url containing ${partialUrl}`,
                   throwIfNotActual(query.browser.url, predicate.includes(partialUrl)));

        export const hasUrl = (url: string): BrowserCondition =>
            lambda(`has url ${url}`,
                   throwIfNotActual(query.browser.url, predicate.equals(url)));

        export const hasTabsNumber = (num: number): BrowserCondition =>
            lambda(`has tabs number ${num}`,
                   throwIfNotActual(query.browser.tabsNumber, predicate.equals(num)));

        export const hasTabsNumberMoreThan = (num: number): BrowserCondition =>
            lambda(`has tabs number more than ${num}`,
                   throwIfNotActual(query.browser.tabsNumber, predicate.isMoreThan(num)));

        export const hasTabsNumberLessThan = (num: number): BrowserCondition =>
            lambda(`has tabs number less than ${num}`,
                   throwIfNotActual(query.browser.tabsNumber, predicate.isLessThan(num)));
    }
}
