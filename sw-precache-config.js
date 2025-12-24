const boards = require('./src/api/boards.json');

function mapImagesToGlobs(boards, globPrefix) {
  let globs = [];
  Object.keys(boards).forEach(boardId => {
    const tiles = boards[boardId].tiles;
    Object.keys(tiles).forEach(tileId => {
      if (tiles[tileId].image) {
        const glob = globPrefix + tiles[tileId].image;
        if (globs.indexOf(glob) >= 0) {
          return;
        }
        globs.push(glob);
      }
    });
  });
  console.log(
    globs.forEach(glob => {
      console.log(glob);
    })
  );
  return globs;
}

const boardImages = mapImagesToGlobs(boards.advanced, 'build/');

module.exports = {
  stripPrefix: 'build/',
  staticFileGlobs: [
    'build/*.html',
    'build/manifest.json',
    'build/static/**/!(*map*)',
    ...boardImages
  ],
  maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, // 8 MB
  runtimeCaching: [
    {
      urlPattern: /\/symbols\/mulberry/,
      handler: 'cacheFirst',
      options: {
        cache: {
          name: 'symbols-mulberry',
          maxEntries: 100
        }
      }
    },
    {
      urlPattern: /\/symbols\/arasaac/,
      handler: 'cacheFirst',
      options: {
        cache: {
          name: 'symbols-arasaac',
          maxEntries: 100
        }
      }
    },
    {
      urlPattern: /\/symbols\/cboard/,
      handler: 'cacheFirst',
      options: {
        cache: {
          name: 'symbols-cboard',
          maxEntries: 100
        }
      }
    },
    // Cache API GET requests for offline support
    {
      urlPattern: /\/api\/(board|communicator|language|cards|jyutping|games|ocr\/history)/,
      handler: 'networkFirst',
      options: {
        cache: {
          name: 'api-cache',
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 // 24 hours
        },
        networkTimeoutSeconds: 3
      }
    },
    // Cache images and media files
    {
      urlPattern: /\.(jpg|jpeg|png|gif|svg|webp|mp3|wav|ogg)$/,
      handler: 'cacheFirst',
      options: {
        cache: {
          name: 'media-cache',
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
        }
      }
    },
    // Cache static assets
    {
      urlPattern: /\/static\//,
      handler: 'cacheFirst',
      options: {
        cache: {
          name: 'static-cache',
          maxEntries: 100
        }
      }
    }
  ],
  navigateFallback: '/index.html',
  dontCacheBustUrlsMatching: /\.\w{8}\./,
  dynamicUrlToDependencies: {
    '/': ['build/index.html']
  },
  swFilePath: 'build/service-worker.js'
};
