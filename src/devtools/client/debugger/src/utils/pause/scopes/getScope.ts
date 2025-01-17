/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

//

import { getBindingVariables } from "./getVariables";
import { getFramePopVariables, getThisVariable } from "./utils";
import { simplifyDisplayName } from "../frames";
import { ValueItem, ContainerItem } from "devtools/packages/devtools-reps";

import type { ValueFront } from "protocol/thread";
import type { ConvertedScope, PauseFrame } from "devtools/client/debugger/src/reducers/pause";

function getScopeTitle(type: string, scope: ConvertedScope) {
  if (type === "function") {
    const name = scope.functionName;
    if (name) {
      return simplifyDisplayName(name);
    } else {
      return "<anonymous>";
    }
  }
  return "Block";
}

export function getScope(
  scope: ConvertedScope,
  selectedFrame: PauseFrame,
  frameScopes: ConvertedScope,
  why: string | null,
  scopeIndex: number
) {
  const { type, actor } = scope;

  const isLocalScope = scope.actor === frameScopes.actor;

  const key = `${actor}-${scopeIndex}`;
  if (type === "function" || type === "block") {
    const { bindings } = scope;

    let vars = getBindingVariables(bindings, key);

    // show exception, return, and this variables in innermost scope
    if (isLocalScope) {
      vars = vars.concat(getFramePopVariables(why, key));

      let thisDesc_ = selectedFrame.this as ValueFront;

      if (bindings && "this" in bindings) {
        // The presence of "this" means we're rendering a "this" binding
        // generated from mapScopes and this can override the binding
        // provided by the current frame.
        // @ts-expect-error `this` doesn't exist in a `bindings` array
        thisDesc_ = bindings.this ? bindings.this.value : null;
      }

      const this_ = getThisVariable(thisDesc_, key);

      if (this_) {
        vars.push(this_);
      }
    }

    if (vars && vars.length) {
      const title = getScopeTitle(type, scope) || "";
      vars.sort((a, b) => a.name!.localeCompare(b.name!));
      return new ContainerItem({
        name: title,
        path: key,
        contents: vars,
      });
    }
  } else if (scope.object) {
    let value = scope.object;
    // If this is the global window scope, mark it as such so that it will
    // preview Window: Global instead of Window: Window
    /*
    if (value.className() === "Window") {
      value = { ...scope.object, displayClass: "Global" };
    }
    */
    return new ValueItem({
      name: value.className(),
      path: key,
      contents: value,
    });
  }

  return null;
}

export function mergeScopes(
  scope: ConvertedScope,
  parentScope: ConvertedScope,
  item: ContainerItem | ValueItem,
  parentItem: ContainerItem | ValueItem
) {
  if (scope.scopeKind == "function lexical" && parentScope.type == "function") {
    const contents = item.getChildren().concat(parentItem.getChildren());
    contents.sort((a, b) => a.name!.localeCompare(b.name!));

    return new ContainerItem({
      name: parentItem.name!,
      path: parentItem.path,
      contents,
    });
  }
}
