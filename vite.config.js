import path from "path";

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
