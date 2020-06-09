const {
  createRemoteFileNode,
  createFileNodeFromBuffer,
} = require(`gatsby-source-filesystem`);
const makeDebug = require('debug');

const { processRemoteImage } = require('./processRemoteImage');
const debug = makeDebug('gatsby-transformer-liist');

const createChildNode = async (_, { definition, imageFields, id }) => {
  debug(
    `Creating ${definition.name} node; imageFields=${imageFields.join(',')}`
  );
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
      debug(`Processing image field "${field}"`);
      if (node[field]) {
        try {
          const remoteImageOptions = processRemoteImage(node[field]);
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
            debug(`Created fileNode=`, fileNode);
            if (fileNode) {
              node[`${field}___NODE`] = fileNode.id;
            }
          }
        } catch (e) {
          console.error(
            `Error getting image for "${field}" error=`,
            e,
            e.stack
          );
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
  debug(`Creating ${definition.name} node for ${node.id} (${id})`);

  // Just for this node, create a local image
  if (dynamicTypes && node.type && node.type === 'Image') {
    debug(`Found dynamic type for key=${node.key}`);
    node.value = {
      raw: node.value,
    };
    localImageFields.push('raw');
  }

  await createChildNode(_, {
    definition,
    imageFields: localImageFields,
    id,
  });
};

const addImageFieldToDefinition = (baseDef, prop) => {
  debug(`Adding image definition for ${prop} to ${baseDef.name}`);
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
        imageFields: imageFields || [],
        definition,
      });
      return {
        ...rest,
        imageFields,
        definition,
      };
    }
  );
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
