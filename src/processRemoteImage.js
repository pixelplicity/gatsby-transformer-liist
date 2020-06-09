const fs = require('fs');
const url = require('url');
const path = require('path');
const download = require('image-downloader');
const makeDebug = require('debug');

const debug = makeDebug('liist-remote-images');
const noProtocolRE = /^\/\//;
const base64PNGRE = /^data:image\/png;base64,/;
const base64SVGRE = /^data:image\/svg\+xml;base64,/;
const base64JPGRE = /^data:image\/jpeg;base64,/;
const invalidHostnames = ['www.dropbox.com'];

const processRemoteImage = (imageURL) => {
  const parsedURL = url.parse(imageURL);
  debug(`Attempting to process image url=%s`, imageURL);
  if (invalidHostnames.includes(parsedURL.hostname)) {
    debug(
      `Skipping: cannot download image from the host %s`,
      parsedURL.hostname
    );
    return null;
  }
  if (base64PNGRE.test(imageURL)) {
    debug('Create buffer from base64 png');
    const data = imageURL.replace(base64PNGRE, '');
    console.log('==>', data);
    return {
      from: Buffer.from(data, 'base64'),
      type: 'buffer',
      extension: '.png',
    };
  }
  if (base64SVGRE.test(imageURL)) {
    debug('Create buffer from base64 svg');
    const data = imageURL.replace(base64SVGRE, '');
    return {
      from: Buffer.from(data, 'base64'),
      type: 'buffer',
      extension: '.svg',
    };
  }
  if (base64JPGRE.test(imageURL)) {
    debug('Create buffer from base64 jpg');
    const data = imageURL.replace(base64JPGRE, '');
    return {
      from: Buffer.from(data, 'base64'),
      type: 'buffer',
      extension: '.jpg',
    };
  }
  if (noProtocolRE.test(imageURL)) {
    debug('No protocol in URL, assuming https');
    imageURL = `https:${imageURL}`;
  }
  const cleanPath = imageURL.split('?')[0];
  const ext = path.extname(cleanPath);
  debug(`File extension ext=${ext}`);

  return {
    from: imageURL,
    type: 'remote',
    extension: ext,
  };
};

const createLocalImage = async ({ imageDest, imageName, imageURL }) => {
  const { from, type, extension } = exports.processRemoteImage(imageURL);
  if (type === 'buffer') {
    await fs.writeFileSync(
      `${imageDest}/${imageName}${extension}`,
      from,
      'base64'
    );
    return `${imageDest}/${imageName}${extension}`;
  }
  if (type === 'remote') {
    debug(`Downloading file to "${imageDest}" from "${imageURL}"`);
    const result = await download
      .image({
        url: imageURL,
        extractFilename: false,
        dest: `${imageDest}/${imageName}${extension}`,
      })
      .catch((e) => {
        debug(`Error downloading image error=${e}`);
        if (/400/.test(e.message) && /http:\/\//.test(e.message)) {
          debug(`Retrying download from https`);
          return createLocalImage(
            imageDest,
            imageName,
            imageURL.replace('http://', 'https://')
          );
        }
        return null;
      });
    return result ? result.filename : null;
  }
};

exports.processRemoteImage = processRemoteImage;
exports.createLocalImage = createLocalImage;
