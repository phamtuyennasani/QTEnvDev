#!/bin/zsh

#ENV#

cd "#CWD#"
nohup "#BIN#" #ARGS# > "#OUTLOG#" 2>"#ERRLOG#" &
echo "##QTEnvDev-Process-ID$!QTEnvDev-Process-ID##"
