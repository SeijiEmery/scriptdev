# scriptdev

This is a collection of some internal scripts and utilities I was working on while at high fidelity.
Pretty much just prototypes, with attempts to work around high fidelity's very limited, and very non-standard scripting api.

It includes a from-scratch implementation of AMD / require that works with Script.include(), and some experiments 
with declarative programming and type annotations (idea was to implement annotations that could wrap functions with
(very slow) typechecking for testing / debugging, and switch to fast / unwrapped on release).

Some of this code might've made it into production with other projects, but I don't remember.

My experiments with implementing require() and type annotation were horrible and never implemented; would've required 
writing code in a very particular (and very non-standard) way, and started looking into adding typescript support instead.
(didn't finish that, sorry hifi users...)
