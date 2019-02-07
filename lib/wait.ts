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

import { OnFailureHook } from './refactor/onFailureHook';
import { TimeoutError } from './errors/timeoutError';
import { ConditionNotMatchedError } from './errors/conditionDoesNotMatchError';
import { Utils } from './helpers/utils';
import lambda = Utils.lambda;

/* tslint:disable:prefer-template */


/**
 * We use queries to perform an async query on entity of type T, i.e. get something from entity.
 * So a query can pass and return something of type R or failed with Error correspondingly.
 */
export type Query<T, R> = (entity: T) => Promise<R>;

/**
 * Commands we use in a normal "command" case, i.e. to perform the async command on entity of type T.
 * Command can pass or fail with Error correspondingly.
 */
export type Command<T> = Query<T, void>;

/**
 * Like Command<T>, i.e. can pass or fail with Error.
 * It is defined as separate type alias to differentiate the usage scenarios.
 * Conditions we use in context of matching condition on entity.
 * Condition is like a predicate but instead of (true | false) you get (passed | throws Error)
 *
 * Read "void" in Query<T, void> as "matched", or "passed".
 */
export type Condition<T> = Query<T, void>;

export namespace Condition {
    export const not = <T>(condition: Condition<T>, description?: string): Condition<T> =>
        lambda(description || `not ${condition}`, async (entity: T) => {
            try {
                await condition(entity);
            } catch (error) {
                return;
            }
            throw new ConditionNotMatchedError();
        });

    /**
     * Transforms Condition (returning (passed | Error))
     * to async Predicate (returning (true | false))
     * @param {Condition<T>} condition
     * @returns {(entity: T) => Promise<boolean>}
     */
    export const asPredicate = <T>(condition: Condition<T>) =>
        (entity: T): Promise<boolean> => condition(entity).then(res => true, err => false);
}

export class Wait<T> {

    constructor(private readonly entity: T,
                private readonly timeout: number,
                private readonly onFailureHooks: OnFailureHook[]) {
        this.entity = entity;
        this.timeout = timeout;
        this.onFailureHooks = onFailureHooks;
    }

    async until(fn: Condition<T>, timeout: number = this.timeout): Promise<boolean> {
        return this.query(fn, timeout).then(res => true, err => false);
    }

    async command(fn: Command<T>, timeout: number = this.timeout) {
        await this.query(fn, timeout);
    }

    async query<R>(fn: Query<T, R>, timeout: number = this.timeout): Promise<R> {
        const finishTime = new Date().getTime() + timeout;

        while (true) {
            try {
                return await fn(this.entity);
            } catch (error) {
                if (new Date().getTime() > finishTime) {
                    throw new TimeoutError(// todo: should we move this error formatting to the Error class definition?
                        '\n' +
                        `\tTimed out after ${timeout}ms, while waiting for:\n` +
                        `\t${this.entity.toString()}.${fn.toString()}\n` + // todo: if string has trailing
                                                                           // and leading spaces it will not be readable
                        'Reason:\n' +
                        `\t${error.message}`
                    );
                }
            }
        }

    }
}
