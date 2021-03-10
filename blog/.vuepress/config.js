module.exports = {
    title: 'VuePress Blog Example', // Title for the site. This will be displayed in the navbar.
    theme: '@vuepress/theme-blog',
    themeConfig: {
        footer: {
            contact: [
              {
                type: 'github',
                link: 'https://github.com/elephantmipt',
              },
              {
                type: 'mail',
                link: 'balaganskij.nn@phystech.edu',
              },
            ],
            copyright: [
                {text: 'MIT Licensed | Copyright © 2021-present Nikita Balagansky'}
            ]
          },
    }
}