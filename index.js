
module.exports = function(mysql){
    var md5=require('md5'),
        compareVersions=require('compare-versions'),
        utils=require('bom-utils'),
        merge=require('merge'),
        _=require('underscore');


    var self_init=function(opts){
            var self=this;
            self.add_schema({'col_name': 'id', 'is_null': false, 'is_base': true, 'size': 20, 'val_type': 'int', 'key_type': 'primary'});
            self.add_schema({'col_name': 'date_stamp', 'is_null': false, 'val_type': 'date', 'key_type': 'updatestamp'});

            var where_obj=new whereBase({'hook_ins':{'where_build': self.column_build_hook(),'where_adhere': self.column_adhere_hook()}}),
                /*where_obj_set=function(v){//setter
                    where_obj=v;},*/
                where_obj_get=function(){//getter
                    return where_obj;},
                silent_obj={'_val':(typeof(opts.silent)==='boolean'?opts.silent:false)};
opts.silent=(typeof(opts.silent)==='boolean'?opts.silent:true);//temp ^_^
            if((typeof(Object.defineProperty)!=='function' && (typeof(this.__defineGetter__)==='function' || typeof(this.__defineSetter__)==='function'))){//use pre IE9
                //this.__defineSetter__('where_obj', where_obj_set);
                this.__defineGetter__('where_obj', where_obj_get);
                this.__defineGetter__('silent', function(){return silent_obj._val;});
            }else{
                Object.defineProperty(this, 'where_obj', {'get': where_obj_get});
                Object.defineProperty(this, 'silent', {'get': function(){return silent_obj._val;}});
            }

            self.hook_ins.change_text('result', "[GENERICDB] When query triggers result 'on(result)' callback");
            self.hook_ins.change_text('fields', "[GENERICDB] When query triggers fields 'on(fields)' callback");
            self.hook_ins.change_text('end', "[GENERICDB] When query triggers end 'on(end)' callback");
            self.hook_ins.change_text('error', "[GENERICDB] When query triggers error 'on(error)' callback");
            self.hook_ins.change_text('done', "[GENERICDB] When query triggers final (finished) callback (custom)");
        };

    //statics
    var column_schema=require('./sub/column')(),// sub-dependancies
        whereBase=require('./sub/where')(),
        genericDBResultStatus=require('./sub/resultModel')(),
        genericDBThrowResultStatus=require('./sub/resultThrow')(),
        genericDBQueryInfo=require('./sub/queryModel')(),
        //\\ sub-dependancies
        GLaDioS=require('GLaDioS')(),
        table_schema={
            'table_name':false,
            'schema':[] //populated in self_init()
        };
    function genericDB(opts){
        if(!opts){opts={};}

        //variables/settings
        this.allow_nolimit=true;
        this.sql_default={'limit':{'row_count':(typeof(opts.row_count)==='number'?opts.row_count:10)}};
        this.table_index=merge(true,{},{'sample_tbl':table_schema});
        this.table_index.sample_tbl.table_name='sample_tbl';
        // this.table_index=merge(true,{},{'log':table_schema});
        // this.table_index.log.table_name='log';
        this.exec_valid_query=(typeof(opts.exec_valid_query)==='boolean'?opts.exec_valid_query:false);
        opts.hook_ins=(typeof(opts.hook_ins)!=='object'?{}:opts.hook_ins);
        this.hook_ins=new GLaDioS({
            'result': (typeof(opts.hook_ins.result)==='function'?opts.hook_ins.result:false),
            'fields': (typeof(opts.hook_ins.fields)==='function'?opts.hook_ins.fields:false),
            'end': (typeof(opts.hook_ins.end)==='function'?opts.hook_ins.end:false),
            'error': (typeof(opts.hook_ins.error)==='function'?opts.hook_ins.error:false),
            'done': (typeof(opts.hook_ins.done)==='function'?opts.hook_ins.done:false)
        });

        self_init.apply(this, [opts]);//start! self_init that passes the 'this' context through
    }

    genericDB.prototype.table_schema=function(){
        return merge(true,{},table_schema);
    };
    genericDB.prototype.add_schema=function(schemaObj, tableName){
        var self=this,new_column=self.column_schema_base(schemaObj);
        tableName=(typeof(tableName)!=='string'?self.main_table():tableName);
        if(!self.is_valid_table(tableName)){throw new Error("Table indicated ('"+tableName+"') was not found");return false;}
        if(typeof(self.table_index[tableName].schema)!=='object'){self.table_index[tableName].schema=[];}

        for(var s in schemaObj){//transfer schemaObj values
            if(utils.obj_valid_key(schemaObj, s)){new_column[s]=schemaObj[s];}}

        if(typeof(new_column.col_name)!=='string' || !utils.basic_str(new_column.col_name)){throw new Error("Column name is invalid");return false;}
        else if(utils.array_object_search(self.table_index[tableName].schema, 'col_name', new_column.col_name).length!==0){throw new Error("Column name '"+new_column.col_name+"' is already existing");return false;}
        self.table_index[tableName].schema.push(new_column);
        return new_column;
    };
    genericDB.prototype.escape=function(valIn, colObj, tableName){//aliased function
        return this.escape_val.apply(this, utils.convert_args(arguments));
    };
    genericDB.prototype.escape_val=function(valIn, colObj, tableName){
        var self=this,
            output='',
            result=true;
        tableName=(typeof(tableName)!=='string'?self.main_table():tableName);
        colObj=(typeof(colObj)==='string'?self.get_column(colObj, tableName):colObj);

        try{
            output=colObj.clean(valIn);//standarize the return
        }catch(e){
            result=false;
            if(!self.silent){
                console.warn("[GENERICDB] escaping value generated errors. "+e.toString());
            }
        }

        if(result===false && output===false){throw new Error("[GENERICDB] could not clean input.");return false;}

        var now_reserved=['CURRENT_TIMESTAMP','NOW()'],
            is_num=(typeof(output)==='number' && (colObj.val_type.toLowerCase()==='int' || colObj.val_type.toLowerCase()==='float')?true:false);
        now_reserved.forEach(function(v,i,arr){now_reserved[i]=v.toUpperCase();});
        if(colObj.is_null && (output===null || typeof(output)==='undefined' || (is_num && isNaN(is_num)) )){//some kind of 'NULL' to mysql
            output='NULL';}
        else if(colObj.val_type.toLowerCase()==='date'){
            var now_stamp=(compareVersions(mysql.version,'5.5')===1?'CURRENT_TIMESTAMP':'NOW()');//greater 5.5 likes CURRENT_TIMESTAMP - less 5.5 likes NOW()
            if(output instanceof Date){//dates need conversion!
                output='FROM_UNIXTIME(' + (Math.floor(output.getTime()/1000)).toString() + ')';}
            else if(typeof(output)==='string' && _.indexOf(now_reserved, output.toUpperCase())!==-1){//already converted to now stamp -  version patch
                output=now_stamp;}
            else if(colObj.key_type.toLowerCase()==='createstamp' || colObj.key_type.toLowerCase()==='updatestamp'){//if its not a string and its a now stamp... WTF?!
                output=now_stamp;}
            else{//something is wrong!
                output=mysql.escape(output.toString());}
        }else if(is_num){//escape as a number! - isNaN covered above!
            output=output.toString();
        }else{//WTF!? or a string :D
            output=mysql.escape(output);//adds quotation marks!
        }
        return output;
    };
    genericDB.prototype.is_valid_table=function(tableName){
        var self=this;
        if(!utils.obj_valid_key(self.table_index, tableName)){return false;}
        return true;
    };
    genericDB.prototype.main_table=function(){
        var self=this;
        return utils.array_keys(self.table_index)[0];
    };
    genericDB.prototype.column_schema_base=function(optsIn){
        var self=this;
        var opts=(typeof(optsIn)==='object'?optsIn:{});
        opts.silent=(typeof(opts.silent)==='boolean'?opts.silent:self.silent);
        return new column_schema(opts);
    };

    genericDB.prototype.column_schema_cols=function(typeIn, tableName){
        var self=this,output=[],whitelist=['primary','foreign','base','all','createstamp','updatestamp'];
        //whitelist.forEach(function(v,i,arr){whitelist[i]=v.toLowerCase();});// maybe needed later?!
        tableName=(typeof(tableName)!=='string'?self.main_table():tableName);
        if(!self.is_valid_table(tableName)){throw new Error("Table indicated was not found");return false;}
        if(_.indexOf(whitelist, typeIn.toLowerCase())===-1){typeIn='all';}//set a default
        typeIn=typeIn.toLowerCase();
        for(var k in self.table_index[tableName].schema){
            if(utils.obj_valid_key(self.table_index[tableName].schema, k)){
                if(typeIn==='base' && self.table_index[tableName].schema[k].is_base===true){
                    output.push(self.table_index[tableName].schema[k].col_name);
                }else if(typeIn==='primary' && self.table_index[tableName].schema[k].key_type==='primary'){
                    output.push(self.table_index[tableName].schema[k].col_name);
                }else if(typeIn==='foreign' && self.table_index[tableName].schema[k].key_type==='foreign'){
                    output.push(self.table_index[tableName].schema[k].col_name);
                }else if(typeIn==='createstamp' && self.table_index[tableName].schema[k].key_type==='createstamp'){
                    output.push(self.table_index[tableName].schema[k].col_name);
                }else if(typeIn==='updatestamp' && self.table_index[tableName].schema[k].key_type==='updatestamp'){
                    output.push(self.table_index[tableName].schema[k].col_name);
                }else{//if all
                    output.push(self.table_index[tableName].schema[k].col_name);
                }
            }
        }
        return output;
    };
    genericDB.prototype.get_column=function(colName, tableName){
        var self=this,output=[];

        tableName=(typeof(tableName)!=='string'?self.main_table():tableName);
        if(!self.is_valid_table(tableName)){throw new Error("Table indicated ('"+tableName+"') was not found");return false;}

        output=utils.array_object_search(self.table_index[tableName].schema, 'col_name', colName);

        return (output.length>0?output[0]:false);
    };
    genericDB.prototype.column_schema_select=function(colObj, tableName, dataObj){
        var self=this,output=[];
    };
    genericDB.prototype.column_schema_where=function(colObj, tableName, dataObj){
        var self=this,
            data_obj_schema={'additional_args':[]},
            col_obj=(typeof(colObj)==='string'?self.get_column(colObj, tableName):colObj);
        if(!(col_obj instanceof column_schema)){throw new Error('[GENERICDB] Validating Where scheam: 1st argument is invalid. Column cannot be found or is invalid type.');return false;}
        if(typeof(dataObj)!=='object'){dataObj=data_obj_schema;}
        for(var a=0, dos_keys=utils.array_keys(dataObj);a<dos_keys.length;a++){
            if(!utils.obj_valid_key(data_obj_schema,dos_keys[a])){
                throw new Error('[GENERICDB] Validating Where scheam: 3rd argument contains invalid key \''+dos_keys[a]+'\'.');return false;}
            else if(dataObj[ dos_keys[a] ]!==false && dataObj[ dos_keys[a] ].constructor!==data_obj_schema[ dos_keys[a] ].constructor){
                throw new Error('[GENERICDB] Validating Where scheam: 3rd argument key \''+dos_keys[a]+'\' is invalid. Expected type \''+data_obj_schema[ dos_keys[a] ].constructor.name+'\'.');return false;}
        }
        if(dataObj.additional_args.length>0){
            for(var a=0;a<dataObj.additional_args.length;a++){
                var cleaned={'result':true,'return':false};
                try{
                    cleaned.return=col_obj.clean(dataObj.additional_args[a]);
                }catch(e){
                    cleaned.result=false;
                }
                if(cleaned.result===true){dataObj.additional_args[a]=cleaned.return;}
            }
        }
    };
    genericDB.prototype.column_schema_write=function(colObj, tableName, dataObj){
        var self=this,output=[];
    };
    genericDB.prototype.column_adhere_hook=function(){//returns a binded function
        var self=this;
        //this is the hook for logic adhere
//console.log('column_adhere_hook ',arguments);
        return function(pkg){//aka new where/logic().adhere() callback
//console.log('============ column_adhere_hook -function ============',pkg);
            var args=[],cols=[];
            for(var s=0;s<pkg.segments.length;s++){
                if(pkg.segments[s] instanceof column_schema){
                    cols.push(s);
                }
                if(_.indexOf(pkg.segment_arg_index,s)!==-1){
                    args.push(s);
                }
            }

            if(args.length>0){
                pkg.output='';
                for(var a=0;a<args.length;a++){//for every argument
                    var arg=pkg.segments[ args[a] ],
                        new_val=arg,
                        do_escape=false;
                    for(var c=0;c<cols.length;c++){//every column (found)
                        var col=pkg.segments[ cols[c] ];
//console.log('column_adhere_hook ['+a+', '+c+'] ------- arg: ',arg,"\n\n",'col ',col,"\n",'col.constructor.name ',col.constructor.name,"\n","column_schema: ",column_schema.name,"\n\n");
                        if(!(arg instanceof column_schema)){//this should always be true
                            do_escape=true;
                        }else{
                            if(arg instanceof column_schema && col instanceof column_schema && args[a]!==cols[c]){
                                if(!self.silent){console.warn("[GENERICDB] column_adhere_hook - Not supported: double column as arguments.");}
                            }else{
                                new_val="`"+self.where_obj.column_seg(arg)+"`";
                            }
                        }
                    }
                    if(do_escape){new_val=self.escape(arg, (pkg.data.prime_arg instanceof column_schema?pkg.data.prime_arg:cols[0]));}
                    pkg.segments[ args[a] ]=new_val;
                }
            }
            //self.clean(arg[a],col[c]);
        };
    };
    genericDB.prototype.column_build_hook=function(){//returns a binded function
        var self=this;
        //this is the hook for logic build - we're going to cause a problem if any of the values of the logic don't match type
        return function(pkg){//aka new logic().build() callback
//console.log('where_build callback!'+this.constructor.name);//this is genericDB
                if(pkg.result!==true){return;}//it already failed; we're not overriding
                var has_col_arg=false;
//console.log('genericDB log-build ',pkg);
                for(var a=0;a<pkg.args.length;a++){
                    if(pkg.args[a] instanceof column_schema){
                        has_col_arg=(has_col_arg===false?[]:has_col_arg);
                        has_col_arg.push(pkg.args[a]);
//console.log('has col arg! ',pkg.args[a]);
                    }
                }
//console.log('============ has_col_arg: '+(has_col_arg===false?'FALSE':has_col_arg));

                if(has_col_arg!==false){
                    for(var c=0;c<has_col_arg.length;c++){
                        var schema_result=true;
//console.log('has_col_arg[c].constructor ',has_col_arg[c] instanceof column_schema, 'column_schema ',column_schema);
                        try{
                            self.column_schema_where(has_col_arg[c], self.main_table(), {'additional_args':pkg.args});//colName, tableName, dataObj)
                        }catch(e){
                            schema_result=false;
                            pkg.fail_reason=pkg.fail_reason+(pkg.fail_reason.length>0?"\n":'')+e.toString();
                            throw new Error("[GENERICDB] Where build failed due to bad value type when used with '"+has_col_arg[c].col_name+"'.\nProvided Error: "+e.toString());
                        }
                        if(!schema_result){
                            pkg.result=false;
                            break;
                        }
                    }
                }
                pkg.result=(has_col_arg===false?false:pkg.result);
                pkg.prime_arg=(has_col_arg!==false?has_col_arg[0]:pkg.prime_arg);
                if(has_col_arg===false){
                    pkg.fail_reason=pkg.fail_reason+(pkg.fail_reason.length>0?"\n":'')+"No arguments provided contain a column.  One arg must be of type '"+column_schema.prototype.constructor.name+"'.";
                }
            };
    };

    genericDB.prototype.apply_callback=function(qModel, callbacksIn, nextFunc, debugVar){// { 'end':function(){},'result':function(row){},'fields':function(fields){},'error':function(err){},'done':function(events, data){} }
//console.log("\n\n\n\n++++++++++++++++++=====\n++++++++++++++++++=====apply_callback===++++++++++++++++++\n++++++++++++++++++\n\n\n\n");

        var self=this,
            // debugVar=(debugVar===true?true:false),
            callbacks={'result':false,'fields':false,'end':false,'error':false,'done':false},
            args=[],
            events=[],
            last_events_len=events.length,
            bool_next=false,
            do_next_immediate_id=false,
            do_next=function(){//do not advance unless a complete flag (end or error) is present
//console.log("\n\n\n\n++++++++++++++++++=====\n++++++++++++++++++=====NEXT CHECK===++++++++++++++++++\n",typeof(nextFunc),' && ',bool_next,"\n++++++++++++++++++\n\n\n\n");
                var found_types=[];
                events.forEach(function(v,i,arr){found_types.push(v.type);});//transfer
                if(last_events_len!=events.length){//we want to do the below when we're done with the events being appeneded
                    queue_next();
                    last_events_len=events.length;
                    return;
                }
                last_events_len=events.length;

                var has_end=(_.indexOf(found_types, 'end')!==-1?true:false),
                    has_err=(_.indexOf(found_types, 'error')!==-1?true:false),
                    has_result=(_.indexOf(found_types, 'result')!==-1?true:false);
                if(has_end===false){//not completed!
                    queue_next();//check again later!
                    return;}
                if(do_next_immediate_id!==false){//we're finally done! - keep the threads clean! Garbage Collection ;)
                    clearImmediate(do_next_immediate_id);
                    do_next_immediate_id=false;
                }
                if(bool_next===false){
                    bool_next=true;//LOCKOUT THE RACE CONDITION!!!
                    //generic callback
                    self.hook_ins.icallback('done',{'events':events,'callbacks':callbacks,'res':qModel.result,'next':nextFunc,'debug':debugVar},function(nArgs){
                        nextFunc=nArgs.next;
                        events=nArgs.events;//debugVar=nArgs.debug;
                    });
                    var out_args=[events], out_data=[];
                    if(has_err===true){events.forEach(function(v,i,arr){if(v.type==='error'){out_data.push(v.args[0]);}});}
                    else if(has_result===true){events.forEach(function(v,i,arr){if(v.type==='result'){out_data.push(v.args[0]);}});}
                    else{events.forEach(function(v,i,arr){if(v.type==='fields'){out_data.push(v.args[0]);}});}

                    if(typeof(callbacks.done)==='function'){
                        var status_obj=new genericDBResultStatus({
                                'is_success':(has_err===false?true:false),// successful! YEA!
                                'events':events,// successful! YEA!
                                'status':(has_err===false?'success':'fail'), //has rows/error! Give the rows/error!
                                'info':{'context':out_data}
                            });

                        callbacks.done.apply(self, new genericDBThrowResultStatus(qModel.result, status_obj, debugVar).asApply());
                    }
                    if(typeof(nextFunc)==='function'){nextFunc.apply(self, out_args);}
                }
            },
            queue_next=function(){//look again later ('setImmediate' like a settimeout)! - don't override the other task
                do_next_immediate_id=(do_next_immediate_id===false?setImmediate(do_next):do_next_immediate_id);
            },
            ready_next=function(typeIn, argsIn){
                var _args=[];
                for(var a=0;a<argsIn.length;a++){_args.push(argsIn[a]);}
                events.push({'type':typeIn,'args':_args});
                do_next();
            };
        if(typeof(callbacksIn)==='function'){callbacksIn={'done':callbacksIn};}//if passed lazily
        for(var k in callbacksIn){//callback system within
            if(utils.obj_valid_key(callbacks,k)){callbacks[k]=callbacksIn[k];}}

        if(typeof(qModel.result)!=='object'){ready_next('end',[]);return false;}//no data - end always happens
        if(typeof(nextFunc)!=='function' && typeof(callbacksIn.done)!=='function'){
            ready_next('end',[]);
            throw new Error("[GENERICDB] Apply Callback has no callback.  Please provide either 'done' callback (2nd argument) or a 'next' callback (3rd argument)");
            return false;
        }

        qModel.result.on('error', function(err) {
//console.log("\n\n\n\n++++++++++++++++++=====\n++++++++++++++++++      error      ++++++++++++++++++\n++++++++++++++++++\n\n\n\n");
            // Handle error, an 'end' event will be emitted after this as well
            self.hook_ins.icallback('error',{'callbacks':callbacks,'res':qModel.result,'err':err,'next':nextFunc,'debug':debugVar},function(nArgs){
                nextFunc=nArgs.next;
                qModel.result=nArgs.res;
                err=nArgs.err;//debugVar=nArgs.debug;
            });
            if(typeof(callbacks.error)==='function'){callbacks.error.apply(self,[qModel.result,err,debugVar]);}
            ready_next('error', arguments);
        })
        .on('fields', function(fields) {
//console.log("\n\n\n\n++++++++++++++++++=====\n++++++++++++++++++      fields      ++++++++++++++++++\n++++++++++++++++++\n\n\n\n");
            // the field packets for the rows to follow
            self.hook_ins.icallback('fields',{'callbacks':callbacks,'res':qModel.result,'fields':fields,'next':nextFunc,'debug':debugVar},function(nArgs){
                nextFunc=nArgs.next;
                qModel.result=nArgs.res;
                fields=nArgs.fields;//debugVar=nArgs.debug;
            });
            if(typeof(callbacks.fields)==='function'){callbacks.fields.apply(self,[qModel.result,fields,debugVar]);}
            ready_next('fields', arguments);
        })
        .on('result', function(row) {
//console.log("\n\n\n\n++++++++++++++++++=====\n++++++++++++++++++      result      ++++++++++++++++++\n++++++++++++++++++\n\n\n\n");
            self.hook_ins.icallback('result',{'callbacks':callbacks,'res':qModel.result,'row':row,'next':nextFunc,'debug':debugVar},function(nArgs){
                nextFunc=nArgs.next;
                qModel.result=nArgs.res;
                row=nArgs.row;//debugVar=nArgs.debug;
            });
            if(typeof(callbacks.result)==='function'){callbacks.result.apply(self,[qModel.result,row,debugVar]);}
            ready_next('result', arguments);
        })
        .on('end', function() {
//console.log("\n\n\n\n++++++++++++++++++=====\n++++++++++++++++++      end      ++++++++++++++++++\n++++++++++++++++++\n\n\n\n");
            // all rows have been received
            self.hook_ins.icallback('end',{'callbacks':callbacks,'res':qModel.result,'next':nextFunc,'debug':debugVar},function(nArgs){
                nextFunc=nArgs.next;
                qModel.result=nArgs.res;//debugVar=nArgs.debug;
            });
            if(typeof(callbacks.end)==='function'){callbacks.end.apply(self,[qModel.result,debugVar]);}
            ready_next('end', arguments);
        });
    };

    genericDB.prototype.find=function(dataObj,callbacks, doDebug){//returns function only!
        var self=this,
            context_key=self.main_table(),
            table_string=self.table_index[context_key].table_name;
//if(doDebug){console.log("[GENDB] context_key ",context_key," this.table_index: ",this.table_index,"\nutils.array_keys(self.table_index)[0] ",utils.array_keys(self.table_index)[0]);}
//console.log('find() dataObj',dataObj);
        if(typeof(dataObj)!=='object'){return false;}//no data
        if(typeof(callbacks)==='function'){callbacks={'done':callbacks};}//if passed lazily
        var sql_select='SELECT ',
            base_cols=self.column_schema_cols('base', context_key),
            sql_from='FROM `'+table_string+'` ',
            all_cols=self.column_schema_cols('all', context_key),
            count=0,
            select_cols=[],
            clean_data={};
        for(var c=0;c<all_cols.length;c++){
            var key=all_cols[c];
            if(utils.obj_valid_key(dataObj,key)){
                if(count!=0){sql_select=sql_select+', ';}
                sql_select=sql_select+'`'+table_string+'`.'+ key +' AS '+key;
                select_cols.push(key);
                clean_data[key]=dataObj[key];
                count++;
            }
        }

        var transform_obj={'where_sql':'','count':0};
        //try{
            self.where_obj.where_list_unset();//reset the chain
            transform_obj=self.where_transform(dataObj, context_key, function(key, whereCount){
                if(_.indexOf(base_cols,key)!==-1 && _.indexOf(select_cols,key)===-1){//if base key and unused
                    if(count!=0){sql_select=sql_select+', ';}
                    sql_select=sql_select+'`'+table_string+'`.'+ key +' AS '+key;
                    select_cols.push(key);
                    count++;
                }
            });
        // }catch(e){
        //     if(!self.silent){console.warn("[GENERICDB] Where build in 'find' failed. "+e.toString());}
        // }
        var sql_where=transform_obj.where_sql;

        if(transform_obj.count===0 || count===0){
if(doDebug){console.log('====== '+context_key+' ||| cont ZERO: transform_obj.count: '+transform_obj.count+'  count: '+count+'  =======');}
            var fail_func=function(){
                var status_obj=new genericDBResultStatus({'is_success':false,'info':{'input':dataObj,'query_segments':[sql_select,sql_where]}});
                callbacks.done.apply(self,new genericDBThrowResultStatus(false, status_obj).asApply());
            };
            return fail_func.bind(self);
        }

        var row_count=(utils.obj_valid_key(dataObj,'limit') && typeof(dataObj.limit)==='object' && utils.obj_valid_key(dataObj.limit,'row_count')?dataObj.limit.row_count:self.sql_default.limit.row_count),
            sql_limit=sql_limit=self.build_limit(dataObj),
            sql_order_by=(utils.obj_valid_key(dataObj,'order_by')?'ORDER BY '+dataObj.order_by:'');// && _.indexOf(all_cols, dataObj.order_by)!==-1 //utils.check_strip_last(utils.check_strip_last(dataObj.order_by,' DESC'),' ASC')
        sql_order_by=(utils.obj_valid_key(dataObj,'group_by')?'GROUP BY '+dataObj.group_by + ' ' + sql_order_by:sql_order_by);// && _.indexOf(all_cols, dataObj.group_by)!==-1
if(doDebug){console.log('find() SEGMENTED SQL ',dataObj,"\n",'sql_select',sql_select+"\n",'sql_from',sql_from+"\n",'sql_where',sql_where+"\n",'sql_order_by',sql_order_by+"\n",'sql_limit',sql_limit);}

        var sql_full=sql_select + ' ' + sql_from + (utils.basic_str(sql_where)?'WHERE '+ sql_where:'') + sql_order_by + (utils.basic_str(sql_limit)?' ' + sql_limit:'') + ';';
if(doDebug){console.log("\n\t",'============== find() SQL: ============== ',"\n",sql_full,"\n");}
        var output_func=function(lastCall){
                self.apply_callback(new genericDBQueryInfo({'result':mysql.query(sql_full),'sql':sql_full,'data':clean_data,'type':'read'}), callbacks, lastCall);//, doDebug
            };
        return output_func.bind(self);
    };
    genericDB.prototype.append=function(dataObj,callbacks,doDebug){
        var self=this;
        if(typeof(dataObj)!=='object'){throw new Error("[GENERICDB] Append was not passed an object as the first argument.");return false;}//no data
        if(typeof(callbacks)==='function'){callbacks={'done':callbacks};}//if passed lazily
        var context_key=self.main_table(),
            table_string=self.table_index[context_key].table_name,
            sql_insert='INSERT INTO `'+table_string+'`(',
            sql_insert_vals=') VALUES (',
            sql_insert_end=');',
            insert_cols=[],
            sql_full='',
            base_cols=self.column_schema_cols('base', context_key),
            all_cols=self.column_schema_cols('all', context_key),
            clean_data={},
            found=0,
            transform_obj={'columns':[],'clean':{},'count':0};
if(!self.silent){console.warn("[genericDB] Should be checking colum types here. Primary Key? Should be Null?\nForeign Key? Should be Found");}
        //try{
            transform_obj=self.insert_transform(dataObj, context_key, function(key, incIn){
                if(_.indexOf(base_cols,key)!==-1 && _.indexOf(insert_cols,key)===-1){//if base key and unused
                    insert_cols.push(key);
                    found++;
                }
            });
        // }catch(e){
        //     if(!self.silent){console.warn("[GENERICDB] Where build in 'append' failed. "+e.toString());}
        // }
        if(found>0){//valid keys found (white list)
            var inc=0;//only for string control
            for(var key in transform_obj.clean){
                if(utils.obj_valid_key(transform_obj.clean, key) && _.indexOf(insert_cols,key)!==-1){
                    if(inc!=0){sql_insert=sql_insert+', ';sql_insert_vals=sql_insert_vals+', ';}
                    sql_insert=sql_insert+'`'+key+'`';
                    sql_insert_vals=sql_insert_vals+transform_obj.clean[key];
                    clean_data[key]=transform_obj.clean[key];
                    inc++;
                }
            }
            sql_insert=sql_insert;
// var strtdstr=') VALUES (';//tmp
// sql_insert_vals=strtdstr+utils.check_strip_first(sql_insert_vals, strtdstr)+'),('+utils.check_strip_first(sql_insert_vals, strtdstr);
            sql_insert_vals=sql_insert_vals;
            sql_full=sql_insert + sql_insert_vals + sql_insert_end;
        }

        if(transform_obj.count===0 || found===0){
if(doDebug){console.log('====== '+context_key+' ||| cont ZERO: transform_obj.count: '+transform_obj.count+'  found: '+found+'  =======');}
            var fail_func=function(){
                var status_obj=new genericDBResultStatus({'is_success':false,'info':{'input':dataObj,'query_segments':[sql_insert, sql_insert_vals, sql_insert_end]}});
                callbacks.done.apply(self,new genericDBThrowResultStatus(false, status_obj).asApply());
            };
            return fail_func.bind(self);
        }

if(doDebug){console.log("\n\t",'============== append() SQL: ============== ',"\n",sql_full,"\n");}
        var output_func=function(lastCall){
if(doDebug){console.log("\n\t",'============== OUTPUT append(): ============== ',"\n",callbacks,"\n");}
                self.apply_callback(new genericDBQueryInfo({'result':mysql.query(sql_full),'sql':sql_full,'data':clean_data,'type':'write'}), callbacks, lastCall);//, doDebug
            };
        return output_func.bind(self);
    };
    genericDB.prototype.update=function(dataObj,callbacks,tableName,errArr,doDebug){//NEEDS UPDATING
        var self=this;
        tableName=(typeof(tableName)!=='string'?self.main_table():tableName);
        if(!self.is_valid_table(tableName)){throw new Error("Table indicated ('"+tableName+"') was not found");return false;}
        var sql_update='UPDATE `'+tableName+'` SET ',
            sql_update_vals='',
            found=0;
        if(typeof(dataObj)!=='object'){return false;}//no data
        if(typeof(callbacks)==='function'){callbacks={'callback':callbacks};}//if passed lazily
console.log("\n\n========= genericDB.prototype.update =========\n\n");
        var valid_res=self.validate_write(dataObj,errArr,true);
        if(valid_res===false){return false;}

        var primary_keys=self.column_schema_cols('primary', tableName),
            foreign_keys=self.column_schema_cols('foreign', tableName);
        if(primary_keys!==false){
            for(var i=0;i<primary_keys.length;i++){
                if(!utils.obj_valid_key(dataObj, primary_keys[i].col_name)){
                    throw new Error("UPDATE must pass primary key such as '"+primary_keys[i].col_name+"'"+(primary_keys.length>1?" (or "+utils.check_strip_last(primary_keys.join(", "), ", ")+")":"")+".");
                    errArr.push('[GENERICDB]no_primary_keys');
                    return false;
                }
            }
        }else if(primary_keys===false && foreign_keys!==false){
            for(var i=0;i<foreign_keys.length;i++){
                if(!utils.obj_valid_key(dataObj, foreign_keys[i].col_name)){
                    throw new Error("UPDATE must pass foreign key such as '"+foreign_keys[i].col_name+"'"+(foreign_keys.length>1?" (or "+utils.check_strip_last(foreign_keys.join(", "), ", ")+")":"")+" if table has no primary key.");
                    errArr.push('[GENERICDB]no_foreign_keys');
                    return false;
                }
            }
        }

        var update_sep=', ',
            has_modified=false,
            update_cols=[],
            modify_dates=self.column_schema_cols('updatestamp', tableName);
        for(var k in dataObj){
            if(utils.obj_valid_key(dataObj,k)){//valid object key (non-prototype)
                var col_data=self.get_column(k, tableName);
                if(col_data===false || col_data.key_type==='primary' || col_data.key_type==='foreign'){continue;}

                if(utils.array_object_search(self.column_schema_cols('all', tableName), 'col_name', k).length>0){//valid db table column name
                    var sql_val=dataObj[k],
                        is_date=(self.table_index[tableName][k].val_type==='date'?true:false);
                    has_modified=(self.table_index[tableName][k].key_type==='updatestamp'?true:has_modified);

                    if(is_date===true && sql_val.toUpperCase()==='CURRENT_TIMESTAMP'){
                        sql_val=(self.mysql_55_hack(sql_val)?'CURRENT_TIMESTAMP':'NOW()');}
                    else{
                        sql_val=mysql.escape(dataObj[k]);}

                    sql_update_vals=sql_update_vals + '`'+k+'`=' + sql_val+update_sep;
                    update_cols.push(k);
                    found++;
                }
            }
        }
        if(found>0 && !has_modified && self.mysql_55_hack('CURRENT_TIMESTAMP')){//5.5 doesn'ts auto-update
            for(var i=0;i<modify_dates.length;i++){
                if(_.indexOf(update_cols, modify_dates[i].col_name)!==-1){continue;}
                sql_update_vals=sql_update_vals + '`'+modify_dates[i].col_name+'`=NOW()'+update_sep;
            }
        }

        if(found===0){//no valid keys found (white list)
            throw new Error("UPDATE data is invalid");errArr.push('[GENERICDB]update_found_0');return false;}
        //valid keys found (white list)
        var where_found=0,
            sql_where='WHERE ',
            where_sep=' AND ';//id=' + mysql.escape(dataObj.id)
        if(primary_keys!==false){
            for(var i=0;i<primary_keys.length;i++){
                if(i!==0){sql_where=sql_where+where_sep;}
                var this_col=primary_keys[i].col_name,
                    col_data=self.get_column(this_col, tableName);
                sql_where=sql_where+'`'+this_col+'`=' + self.escape_val(dataObj[this_col], this_col, tableName);
                where_found++;
            }
        }else if(primary_keys===false && foreign_keys!==false){
            for(var i=0;i<foreign_keys.length;i++){
                if(i!==0){sql_where=sql_where+where_sep;}
                var this_col=foreign_keys[i].col_name,
                    col_data=self.get_column(this_col, tableName);
                sql_where=sql_where+'`'+this_col+'`=' + self.escape_val(dataObj[this_col], this_col, tableName);
                where_found++;
            }
        }

        if(where_found===0){//no where keys found
            throw new Error("UPDATE data is invalid for WHERE statement");errArr.push('[GENERICDB]update_where_found_0');return false;}
        sql_update=sql_update + utils.check_strip_last(sql_update_vals,update_sep)+' '+sql_where + ';';

        if(doDebug){console.log("\n\n\t========= ========= genericDB.prototype.update \n\t",'sql_update ',sql_update,"\n\n");}

        //var final_func=self.apply_callback(mysql.query(sql_update), callbacks, self.query_last_result(callbacks,doDebug));
        var final_func=self.apply_callback.bind(self, mysql.query(sql_update), callbacks, self.query_last_result(callbacks,doDebug));
        if(self.exec_valid_query){
            final_func();
            return true;
        }else{
            return final_func;
        }
    };

    genericDB.prototype.query_last_result=function(callbacks,doDebug){//depricated
        var self=this;
        return function(res,cbs,arg){//res,cbs,arg - arguments supplied from apply_callback()
            for(var _args=[],a=0;a<arguments.length;a++){_args.push(arguments[a]);}
            if(typeof(callbacks.last)==='function'){callbacks.last.apply(self,_args);}//callbacks.last(this_arguments[0], ... ,this_arguments[ this_arguments.length-1 ]

            for(var _args=['last'],a=0;a<arguments.length;a++){_args.push(arguments[a]);}
            if(typeof(callbacks.callback)==='function'){callbacks.callback.apply(self,_args);}//callbacks.callback('last',this_arguments[0], ... ,this_arguments[ this_arguments.length-1 ]
        };
    };

    genericDB.prototype.build_limit=function(dataObj){
        var self=this,
            row_count=(utils.obj_valid_key(dataObj,'limit') && typeof(dataObj.limit)==='object' && utils.obj_valid_key(dataObj.limit,'row_count')?dataObj.limit.row_count:self.sql_default.limit.row_count),
            sql_limit=(utils.obj_valid_key(dataObj,'limit') && typeof(dataObj.limit)==='object'?'LIMIT ' + dataObj.limit.pos + ', ' + dataObj.limit.row_count:'');
        sql_limit=(utils.basic_str(sql_limit)?sql_limit:'LIMIT '+row_count);
        sql_limit=(utils.obj_valid_key(dataObj,'nolimit') && dataObj.nolimit===true && self.allow_nolimit?'':sql_limit);
        return sql_limit;
    };
    genericDB.prototype.insert_transform=function(dataObj, tableName, itFunc){
        var self=this,
            found_cols=[],
            clean_vals={},
            all_cols=self.column_schema_cols('all', tableName),
            i_count=0;

        for(var c=0;c<all_cols.length;c++){
            var key=all_cols[c];
            if(utils.obj_valid_key(dataObj,key) && _.indexOf(all_cols,key)!==-1){
                //if(i_count!=0){}
                found_cols.push(key);
                clean_vals[key]=self.escape_val(dataObj[key], self.get_column(key,tableName), tableName);
                i_count++;
            }
            if(typeof(itFunc)==='function'){itFunc(key,i_count);}
        }
        return {'columns':found_cols,'clean':clean_vals,'count':i_count};

    };
    genericDB.prototype.where_transform=function(dataObj, tableName, itFunc){
        var self=this,
            all_cols=self.column_schema_cols('all', tableName),
            w_count=0;

        for(var c=0;c<all_cols.length;c++){
            var key=all_cols[c];
            if(utils.obj_valid_key(dataObj,key) && _.indexOf(all_cols,key)!==-1){
                var seek=utils.array_object_search(self.table_index[tableName].schema,'col_name',key),
                    where_logic=self.where_obj.schema();
                if(w_count!=0){
                    var where_comp=self.where_obj.schema('comp');//ideally it will eventually look like where.build().and().push();
                    where_comp.build('AND');
                    self.where_obj.push(where_comp);
                }
                if(typeof(dataObj[key])==='object' && dataObj[key] instanceof Array && dataObj[key].length>0){//if the column is a enum we need to adjust this
                    where_logic.build.apply(where_logic,[seek[0], 'IN', dataObj[key]].concat(dataObj[key]));
                }else{
                    where_logic.build(seek[0], '=', dataObj[key]);
                }
                self.where_obj.push(where_logic);
                w_count++;
            }
            if(typeof(itFunc)==='function'){itFunc(key,w_count);}
        }

        return {'where_sql':self.where_obj.adhere(),'count':w_count};
    };


    //genericDB.prototype.mysql_55_date_hack=function(dateIn){
    genericDB.prototype.mysql_55_hack=function(dateIn){//incomplete but basically a manual switch for now - depricated
        var self=this;
        // return (compareVersions(mysql.version,'5.5'!==1) && dateIn.toUpperCase()==='CURRENT_TIMESTAMP'?true:false);
        return (mysql.version=='5.5' && dateIn.toUpperCase()==='CURRENT_TIMESTAMP'?true:false);
    };
    genericDB.prototype.validate_write=function(){//depricated
        var self=this;
    };
    genericDB.prototype.parse_result_status=function(statusModelIn){
        var self=this;
    };
    genericDB.prototype.terminate=function(next){
        var self=this;
        mysql.end(function(err){
            if(err){throw new Error("[GENERICDB] "+err.toString());}
            if(typeof(next)==='function'){next();}
        });
    };
    return genericDB;
};
