import path from "path";

// This configuration is now only for building the library.
export default {
    build: {
        minify: false,
        lib: {
            entry: path.resolve(__dirname, "src/ossos.ts"),
            name: "ossos",
            formats: ["es", "cjs"],
        },
        rollupOptions: {
            external: ["three", /^three\//],
        },
    },
};
