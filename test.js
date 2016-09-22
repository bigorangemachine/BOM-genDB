
//modules
var _ = require('underscore'),//http://underscorejs.org/
    merge = require('merge'),//allows deep merge of objects
    mysql = require('mysql'),//https://github.com/felixge/node-mysql/
    fs = require('fs'),
    utils=require('bom-utils'),
    vars=require('bom-utils/vars'),
    merge=require('merge'),
    _=require('underscore');
//custom modules
//var utils = require('../utils');
//varaibles
var doc_root='',
    root_params={
        'silent':false,//actual settings
        'rootmodule':'',
        'config':'./config',
        'found_params':[]
    };
var config=require('../configurator')(process, fs, root_params);
doc_root=root_params.doc_root;

if(!config || config.db.type.toLowerCase()!=='mysql'){console.error('ONLY DEVELOPED FOR MYSQL');process.exit();}
if(!root_params.silent){console.log('DB SETTINGS: ',merge(true,{},config.db,{'user':vars.const_str.omitted,'pass':vars.const_str.omitted}));}
var mysql_conn = mysql.createConnection({
        //'debug':true,
        'database':config.db.db,
        'host': config.db.host,
        'user': config.db.user,
        'password': config.db.pass
    });
mysql_conn.version=config.db.version;

var do_terminate=function(reportTrace){
        if(!root_params.silent){
            if(reportTrace){console.trace();}
            console.log("\n\n\n================= do_terminate PID: "+process.pid+" =================","\n");
        }
		mysql_conn.end(function(err){/*The connection is terminated now*/
//console.log('===mysql_conn.end===',arguments);
            process.on('exit', function(code){
                if(!root_params.silent){
                    console.log('===PROCESS process.on(\'exit\') EVENT===');
                    console.log("\n================= \\\\do_terminate PID: "+process.pid+" =================","\n\n");
                }
            });
            process.exit();//nothing happens after this - except the event hadler
		});
    },
    do_init=function(){//initalize
        /*
            - start mysql
        */
		mysql_conn.connect(function(err) {
			if(err){
                console.error('MYSQL ERROR CONNECTING: ' + err.toString());//was err.stack - more detailed
                do_terminate(false);
                return;
            }

            //custom modules -  mysql dependent
            var genDB=require('../genDB')(mysql_conn),
                do_sets=[
                    function(){
                        try{tests.test_build_least(true);}
                        catch(e){throw new Error(e.toString());}

                        try{tests.test_build_least(false);}
                        catch(e){throw new Error(e.toString());}

                        try{tests.test_build_fail(true);}
                        catch(e){throw new Error(e.toString());}

                        try{tests.test_build_fail(false);}
                        catch(e){throw new Error(e.toString());}
                    },
                    function(){
                        try{tests.test_build_with_comp_op();}
                        catch(e){throw new Error(e.toString());}

                        try{tests.test_build_with_comp_op_fail();}
                        catch(e){throw new Error(e.toString());}
                    },
                    function(){//find query
                        try{genDB_obj.find({'id':1},function(queryObj, status, eventsIn, debugVar){/*something?*/});}
                        catch(e){throw new Error(e.toString());}
                    }/*,
                    function(){
                        try{xxxxxxxxx}
                        catch(e){throw new Error(e.toString());}
                    }*/
                ];

            for(var d=0;d<do_sets.length;d++){
                var genDB_obj=new genDB(),
                    where_obj=genDB_obj.where_obj,
                    tests=require('./sub/tests')(genDB_obj, where_obj);
                (function(genericDB){
                    do_sets[d].apply();
                })(genDB);
            }

            do_terminate(false);//do this if blocking!
        });
	};

do_init();
