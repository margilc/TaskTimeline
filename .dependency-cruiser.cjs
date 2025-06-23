/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  // Define which files to include/exclude from analysis
  options: {
    // Include only TypeScript files in src directory
    includeOnly: "^src",
    
    // Exclude specific patterns (examples commented out)
    // exclude: {
    //   path: ["node_modules", "test", "spec", "\\.d\\.ts$"],
    //   dynamic: true // exclude dynamic imports
    // },
    
    // Module systems to recognize
    moduleSystems: ["es6", "cjs", "tsd"],
    
    // TypeScript configuration
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json"
    },
    
    // Enhanced resolver options
    enhancedResolveOptions: {
      // Add custom extensions if needed
      extensions: [".ts", ".js", ".json"]
    },
    
    // Report options for DOT output
    reporterOptions: {
      dot: {
        // Collapse directories to reduce clutter
        collapsePattern: "^src/[^/]+/[^/]+/[^/]+",
        
        // Color scheme for different module types
        theme: {
          // Dependency types and their colors
          modules: [
            {
              // Core modules (state management) - red tint
              criteria: { path: "^src/core" },
              attributes: {
                fillcolor: "#ffcccc",
                style: "filled"
              }
            },
            {
              // Component modules - green tint
              criteria: { path: "^src/components" },
              attributes: {
                fillcolor: "#ccffcc",
                style: "filled"
              }
            },
            {
              // View modules - blue tint
              criteria: { path: "^src/views" },
              attributes: {
                fillcolor: "#ccccff",
                style: "filled"
              }
            },
            {
              // Interface/type definitions - yellow tint
              criteria: { path: "^src/interfaces" },
              attributes: {
                fillcolor: "#ffffcc",
                style: "filled"
              }
            },
            {
              // Utility modules - purple tint
              criteria: { path: "^src/utils" },
              attributes: {
                fillcolor: "#ffccff",
                style: "filled"
              }
            }
          ],
          
          // Edge (dependency) styling
          dependencies: [
            {
              // Type-only dependencies (lighter arrows)
              criteria: { dependencyTypes: ["type-only"] },
              attributes: {
                color: "gray",
                style: "dashed"
              }
            }
          ],
          
          // Overall graph styling
          graph: {
            splines: "ortho",     // ortho creates horizontal/vertical lines only
            rankdir: "LR",        // TB (top-bottom), LR (left-right)
            fontname: "Arial",
            fontsize: "20",       // Larger font size
            nodesep: "0.8",       // Slightly more horizontal spacing
            ranksep: "1.5",       // More space between dependency levels
            concentrate: "false", // Don't merge edges - might help spread
            pack: "true",        // Don't pack components tightly
            packMode: "array"     // Array packing mode for better distribution
          },
          
          // Node styling to make elements bigger
          node: {
            fontsize: "16",
            height: "0.8",
            width: "1.6"
          }
        }
      }
    }
  },
  
  // Define rules for dependency validation
  forbidden: [
    {
      name: "no-circular",
      comment: "Prevent circular dependencies",
      severity: "warn",
      from: {},
      to: {
        circular: true
      }
    },
    {
      name: "no-orphans", 
      comment: "Flag modules that aren't used anywhere",
      severity: "info",
      from: {
        orphan: true,
        pathNot: "^src/(main|index)"  // Allow main entry points to be orphans
      },
      to: {}
    }
  ]
};