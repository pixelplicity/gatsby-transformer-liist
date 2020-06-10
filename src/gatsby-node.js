const fs = require('fs');
const get = require('lodash.get');
const set = require('lodash.set');
const {
  createRemoteFileNode,
  createFileNodeFromBuffer,
} = require(`gatsby-source-filesystem`);
const makeDebug = require('debug');

const { processRemoteImage } = require('./processRemoteImage');
const debug = makeDebug('gatsby-transformer-liist');

const createChildNode = async (_, { definition, imageFields, id }) => {
  const {
    actions,
    node,
    createNodeId,
    cache,
    store,
    getCache,
    createContentDigest,
  } = _;
  const { createNode, createParentChildLink } = actions;
  await Promise.all(
    imageFields.map(async (field) => {
      const fieldValue = get(node, field);
      debug(`Processing image field "${field}"=>${fieldValue}`);
      if (fieldValue) {
        try {
          const remoteImageOptions = processRemoteImage(fieldValue);
          if (remoteImageOptions !== null) {
            let fileNode;
            if (remoteImageOptions.type === 'remote') {
              debug(`Creating remote local image for ${field}`);
              fileNode = await createRemoteFileNode({
                url: remoteImageOptions.from,
                parentNodeId: id,
                createNode,
                createNodeId,
                cache,
                store,
              });
            } else {
              debug(`Creating local image from buffer for ${field}`);
              fileNode = await createFileNodeFromBuffer({
                buffer: remoteImageOptions.from,
                getCache,
                createNode,
                createNodeId,
              });
            }
            if (fileNode) {
              set(node, `${field}___NODE`, fileNode.id);
            }
          }
        } catch (e) {
          console.error(`Error getting image for "${field}" error=`, e);
        }
      }
    })
  );
  const newNode = {
    ...node,
    id,
    children: [],
    parent: node.id,
    internal: {
      contentDigest: createContentDigest(node),
      type: definition.name,
    },
  };
  createNode(newNode);
  createParentChildLink({ parent: node, child: newNode });
};

const makeNode = async (_, { types }) => {
  const { node, createNodeId } = _;
  const type = types.find((type) => type.nodeType === node.internal.type);
  if (!type) {
    return;
  }
  const { dynamicTypes, imageFields = [], definition } = type;
  let localImageFields = imageFields.slice();

  const id = createNodeId(node.id);
  if (dynamicTypes) {
    if (node.type) {
      if (node.type === 'Image') {
        debug(`Found dynamic image type for key=${node.key}`);
        localImageFields.push('value.raw');
      }
      node.value = {
        type: node.type,
        raw: node.value,
      };
    } else {
      return;
    }
  }

  await createChildNode(_, {
    definition,
    imageFields: localImageFields,
    id,
  });
};

const addImageFieldToDefinition = (baseDef, prop) => {
  debug(`Adding image definition for "${prop}" field to ${baseDef.name}`);
  const newDef = { ...baseDef };
  newDef.fields[prop] = {
    type: 'File',
    resolve: (raw, args, context) => {
      return context.nodeModel.getNodeById({
        id: raw[`${prop}___NODE`],
        type: 'File',
      });
    },
  };
  return newDef;
};

exports.onPreInit = ({ store }, { types }) => {
  debug(`Updating definitions`);
  const state = store.getState();
  const plugin = state.flattenedPlugins.find(
    (plugin) => plugin.name === 'gatsby-transformer-liist'
  );
  plugin.pluginOptions.types = types.map(
    ({ definition, dynamicTypes, ...rest }) => {
      const imageFields = Object.entries(definition.fields)
        .filter(([fieldName, fieldDef]) => fieldDef === 'Image')
        .map(([fieldName]) => fieldName);
      imageFields.forEach((prop) => {
        definition = addImageFieldToDefinition(definition, prop);
      });
      // Dynamically processed fields need a custom resolver
      if (dynamicTypes) {
        definition.fields.value = 'LiistDynamicType';
      }
      debug(`Updated definitions for ${definition.name} to`, {
        ...rest,
        dynamicTypes,
        imageFields: imageFields || [],
        definition,
      });
      return {
        ...rest,
        dynamicTypes,
        imageFields,
        definition,
      };
    }
  );
};

exports.onPreBootstrap = ({ cache }) => {
  const dir = cache.directory;
  debug(`Ensuring cache directory "${cache.directory}" exists`);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
};

exports.onCreateNode = async (_, options) => {
  await makeNode(_, options);
};

exports.createSchemaCustomization = ({ actions, schema }, { types }) => {
  const { createTypes } = actions;
  let typeDefs = [
    schema.buildObjectType({
      name: 'LiistDynamicType',
      fields: {
        raw: 'String',
        type: 'String',
        value: {
          type: 'File',
          resolve: (source, args, context) => {
            if (source.type === 'Image') {
              return context.nodeModel.getNodeById({
                id: source.raw___NODE,
                type: 'File',
              });
            }
            return null;
          },
        },
      },
      interfaces: ['Node'],
    }),
  ];

  typeDefs = [
    ...typeDefs,
    ...types.map((type) => schema.buildObjectType(type.definition)),
  ];
  createTypes(typeDefs);
};
