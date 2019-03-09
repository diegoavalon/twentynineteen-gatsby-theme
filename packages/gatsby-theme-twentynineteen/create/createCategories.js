const axios = require("axios")
const config = require("../config")
const categoryArchiveTemplate = require.resolve(
  `../src/templates/categories/archive.js`
)
const categoryTemplate = require.resolve(
  `../src/templates/categories/single.js`
)

/**
 * This is the query that is used to fetch the categories to
 * create the single category and category archive pages.
 *
 * @todo: define/use fragments for each template...
 *
 * @type {string}
 */
const GET_CATEGORIES = `
# Define our query variables
query GET_CATEGORIES($first:Int $after:String) {

  # Ask for categories
  categories(
    # Ask for the first XX number of categories
    first:$first 
    
    # A cursor to where in the dataset our query should begin
    # and get items _after_ that point
    after:$after
  ) {
  
    # In response, we'll want pageInfo so we know if we need
    # to fetch more posts or not
    pageInfo {
    
      # If true, we need to ask for more data
      hasNextPage
      
      # This cursor will be used for the value for $after
      # if we need to ask for more data
      endCursor
    }
    nodes {
    
      # The fields needed to create the templates
      name
      slug
      posts {
        nodes {
          id
          postId
          title
          slug
          excerpt
          uri
          author {
            name
            avatar(size:50) {
              url
            }
            slug
          }
          date
          categories {
            nodes {
              name
              slug
            }
          }
          tags {
            nodes {
              slug
              name
            }
          }
        }
      }
    }
  }
}
`

/**
 * This is the export which Gatsby will use to process.
 *
 * @param actions
 * @returns {Promise<void>}
 */
module.exports = async ({ actions }) => {
  /**
   * This is the method from Gatsby that we're going
   * to use to create pages in our static site.
   */
  const { createPage } = actions

  /**
   * Array to store allCategories. We make paginated requests
   * to WordPress to get allCategories, and once we have all categories,
   * then we iterate over them to create pages.
   *
   * @type {Array}
   */
  const allCategories = []

  /**
   * Here we store an array of archivePages. For each xx amount of categories
   * we want to create a category archive page so users can browse
   * chunks of data at a time, much like a traditional
   * WordPress paginated archive page.
   *
   * @type {Array}
   */
  const archivePages = []

  /**
   * We need to track the page number so we can output the paginated
   * archive template with the appropriate path.
   *
   * @type {number}
   */
  let pageNumber = 0

  /**
   * Fetch categories method. This accepts variables to alter
   * the query. The variable `first` controls how many items to
   * request per fetch and the `after` controls where to start in
   * the dataset.
   *
   * @param variables
   * @returns {Promise<*>}
   */
  const fetchCategories = async variables => {
    /**
     * Use Axios to fetch categories using
     * the GET_CATEGORIES query and the variables passed in.
     */
    return await axios({
      url: `${config.wordPressUrl}/graphql`,
      method: "post",
      data: {
        query: GET_CATEGORIES,
        variables,
      },
      /**
       * The results of the Axios request are passed here
       */
    }).then(({ data }) => {
      /**
       * Extract the data from the GraphQL query results
       */
      const {
        data: {
          categories: {
            pageInfo: { endCursor, hasNextPage },
            nodes,
          },
        },
      } = data

      /**
       * Define the path for the paginated archive page.
       * This is the url the page will live at
       * @type {string}
       */
      const categoryArchivePath = !variables.after
        ? `/categories/`
        : `/categories/page/${pageNumber}`

      /**
       * Add config for the archivePage to the archivePages array
       * for creating later
       *
       * @type {{path: string, component: string, context: {nodes: *, pageNumber: number, hasNextPage: *}}}
       */
      archivePages[pageNumber] = {
        path: categoryArchivePath,
        component: categoryArchiveTemplate,
        context: {
          nodes,
          pageNumber,
          hasNextPage,
        },
      }

      /**
       * Map over the categories for later creation
       */
      nodes &&
        nodes.map(category => {
          allCategories.push(category)
        })

      /**
       * If there's another page, fetch more
       * so we can have all the data we need.
       */
      if (hasNextPage) {
        pageNumber++
        console.log(`fetch page ${pageNumber} of categories...`)
        return fetchCategories({ first: 10, after: endCursor })
      }

      /**
       * Once we're done, return all the categories
       * so we can create the necessary pages with
       * all the data on hand.
       */
      return allCategories
    })
  }

  /**
   * Kick off our `fetchCategories` method which will get us all
   * the posts we need to create individual category pages
   * and paginated category archive pages.
   */
  await fetchCategories({ first: 10, after: null }).then(allCategories => {
    /**
     * Map over the allCategories array to create the
     * single-category pages
     */
    allCategories &&
      allCategories.map(category => {
        console.log(`create category: ${category.slug}`)
        createPage({
          path: `/blog/category/${category.slug}`,
          component: categoryTemplate,
          context: category,
        })
      })

    /**
     * Map over the `archivePages` array to create the
     * paginated category archive pages
     */
    archivePages &&
      archivePages.map(archivePage => {
        console.log(
          `create category archive page ${archivePage.context.pageNumber}`
        )

        /**
         * @todo: Need to actually make these paginated
         * archive pages, which means we'll have to
         * fetchPosts for each category, much like we did
         * for the posts/archive template.
         */
        createPage(archivePage)
      })
  })
}
