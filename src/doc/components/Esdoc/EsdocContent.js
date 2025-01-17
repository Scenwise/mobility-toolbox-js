/* eslint-disable react/prop-types */
import React from 'react';
import docss from './index.json';
import ClassDoc from './ClassDoc';
import IdentifiersDoc from './IdentifiersDoc';
import SingleDoc from './SingleDoc';
import {
  _resolveExtendsChain,
  _resolveNecessary,
  _resolveIgnore,
  _resolveLink,
} from './DocBuilderUtils';

// Preprocess the index.json content.
// https://github.com/esdoc/esdoc-plugins/blob/2de5022baa569785a189056a99acd1d7ca8284b7/esdoc-publish-html-plugin/src/Builder/DocResolver.js
let docs = _resolveExtendsChain(docss);
docs = _resolveNecessary(docs);
docs = _resolveIgnore(docs);
docs = _resolveLink(docs);

function EsdocContent({ path }) {
  let doc;

  if (!path) {
    return null;
  }

  const [firstPath] = path.split('#')[0].split('/');
  if (path) {
    doc = docs.find((item) => {
      const [docLongName] = item.longname.split('#');
      const reg = new RegExp(docLongName);
      if (reg.test(path) && item.kind === 'class') {
        return item;
      }
      return null;
    });
  }

  return (
    <div className="content">
      {/^identifiers/.test(path) && <IdentifiersDoc docs={docs} />}
      {firstPath === 'class' && doc && <ClassDoc doc={doc} />}
      {firstPath === 'variable' && <SingleDoc kind={firstPath} />}
      {firstPath === 'typedef' && <SingleDoc kind={firstPath} />}
      {firstPath === 'function' && <SingleDoc kind={firstPath} />}
    </div>
  );
}

export default React.memo(EsdocContent);
