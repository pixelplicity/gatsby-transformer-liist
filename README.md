# gatsby-transformer-liist

[![npm package](https://flat.badgen.net/npm/v/gatsby-transformer-liist)](https://badgen.net/npm/v/gatsby-transformer-liist)
[![Maintainability](https://flat.badgen.net/codeclimate/maintainability/Aquilio/gatsby-transformer-liist)](https://codeclimate.com/github/Aquilio/gatsby-transformer-liist/maintainability)
![Dependabot](https://flat.badgen.net/dependabot/thepracticaldev/dev.to?icon=dependabot)

A Gatsby transformer to convert spreadsheet nodes into resources and content for [Liist](https://liist.io) sites.

---

- [Install](#install)
  - [Manual](#manual)
- [How to use](#how-to-use)
  - [Options](#options)
  - [Definitions](#definitions)
  - [Images](#images)
  - [Dynamic Types](#dynamic-types)
- [Changelog](#changelog)
- [License](#license)

## Install

### Manual

1. Install `gatsby-transformer-liist`

   `npm install --save gatsby-transformer-liist`

2. Add plugin to `gatsby-config.js`

   ```javascript
   // In your gatsby-config.js
    module.exports = {
      plugins: [
        {
        resolve: `gatsby-transformer-liist`,
        options: {
          types: [...]
      ],
    };
   ```

## How to use

### Options

| Option               | Explanation                                   |
| -------------------- | --------------------------------------------- |
| `types`              | An array of node types                        |
| `types.nodeType`     | The type of node that creates this child node |
| `types.dynamicTypes` | Whether the type for each node is dynamic     |
| `types.definition`   | A GatsbyJS type builder object                |

### Definitions

Definitions are passed to Gatsby's `schema.buildObjectType`. The Gatsby [docs](https://www.gatsbyjs.org/docs/schema-customization/#gatsby-type-builders) cover all the options available.

### Images

Any field with a type of `Image` will have it's type changed to `File` and have a custom resolver function added that links to a `FileNode` that is created from the url value.

### Dynamic Types

Certain nodes can have their type determined by a `type` field. These nodes will be created with a `value` field of type `LiistDynamicType`. The resulting node then becomes:

```
{
  key: 'someKey',
  value: {
    type: 'Image',
    raw: 'image.jpg',
    value: {...} // childImageSharpNode
  }
}
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](https://github.com/Aquilio/gatsby-transformer-liist/blob/master/LICENSE) © [Aquil.io](https://aquil.io)
