
module.exports = function(){
    //private dependancies
    var GLaDioS=require('GLaDioS')(),utils=require('bom-utils'),merge=require('merge'),_=require('underscore');

    var self_init=function(schemaIn){//private scope
        var schema=this.schema();
        for(var s in schema){
            if(utils.obj_valid_key(schema, s)){this[s]=(typeof(schemaIn[s])!=='undefined'?schemaIn[s]:schema[s]);}}
    };
    //statics
    var column_schema={
            'is_null': true,//boolean
            'is_base': false,//boolean
            'col_name': false,//string
            'size': 1,//number | [ number ] | [ list ]
            'val_type': 'boolean',// boolean|int|float|enum|string|date -> enum needs whitelist: this.size=[ list ];
            'key_type': false //primary|foreign|unique|index|createstamp|updatestamp|false -> createstamp & updatestamp is for date only
        };
    function columnSchema(opts){
        if(!opts){opts={};}
        //this.xxxxx={'limit':{'row_count':(typeof(opts)!=='undefined' && typeof(opts.xxxxx)==='number'?opts.xxxxx:9000)}};

        //private variables - need to be objects
        var silent_obj={'_val':(typeof(opts.silent)==='boolean'?opts.silent:false)};
        if((typeof(Object.defineProperty)!=='function' && (typeof(this.__defineGetter__)==='function' || typeof(this.__defineSetter__)==='function'))){//use pre IE9
            //this.__defineSetter__('operator_index', function(v){operator_index=merge(true,{}, operator_index, v);});
            this.__defineGetter__('silent', function(){return silent_obj._val;});
        }else{
            Object.defineProperty(this, 'silent', {
            //'set': function(v){operator_index=merge(true,{}, operator_index, v);},//setter
            'get': function(){return silent_obj._val;}//getter
            });
        }

        var clean_schema=this.schema();
        for(var s in clean_schema){//set schema default
            if(utils.obj_valid_key(clean_schema, s)){clean_schema[s]=(typeof(opts[s])!=='undefined'?opts[s]:clean_schema[s]);}}

        if(!this.validate(clean_schema)){
            throw new Error("[COLUMNSCHEMA] Bad inital schema.");
        }else{
            self_init.apply(this, [clean_schema]);//start! self_int(opts) that passes the 'this' context through
        }
	};

    columnSchema.prototype.schema=function(){
        return merge(true, {}, column_schema);//break pass by reference
    };


    columnSchema.prototype.validate=function(schemaObj, errArr){
        var self=this,new_column={};
        if(typeof(errArr)!=='object'){errArr=[];}
        new_column=merge(true, {}, self.schema(), schemaObj);
        new_column.key_type=(typeof(new_column.key_type)==='string'?new_column.key_type.toLowerCase():new_column.key_type);
        new_column.val_type=(typeof(new_column.val_type)==='string'?new_column.val_type.toLowerCase():new_column.val_type);


        if(new_column.val_type==='boolean'){
            new_column.size=1;
        }else if(new_column.val_type==='int'){//-9223372036854775808 to 9223372036854775807 or 0 to 18446744073709551615 (max length of 20)
            new_column.size=(typeof(new_column.size)==='number'?new_column.size:20);
            if(typeof(new_column.size)!=='number'){errArr.push('int_size');throw new Error("[COLUMNSCHEMA] Table column type is int but size is not a number");return false;}
        }else if(new_column.val_type==='float'){//1 to 65 - decimal 0 to 30
            new_column.size=(typeof(new_column.size)==='number' || typeof(new_column.size)==='object'?new_column.size:[65,30]);
            if(typeof(new_column.size)!=='number' && typeof(new_column.size)!=='object'){errArr.push('float_size');throw new Error("[COLUMNSCHEMA] Table '"+new_column.col_name+"' column type is float but size is not a number or array");return false;}
            else if(typeof(new_column.size)==='object' && (new_column.size.length!=2 || typeof(new_column.size[0])!=='number' || typeof(new_column.size[1])!=='number')){errArr.push('float_size_type');throw new Error("[COLUMNSCHEMA] Table '"+new_column.col_name+"' column type is float but size is not a pair of numbers");return false;}
        }else if(new_column.val_type==='enum'){//I hate enums.... will do if necessary
            errArr.push('enums_dev');throw new Error("[COLUMNSCHEMA] Enums currently not built");return false;
        }else if(new_column.val_type!=='date' && _.indexOf(['createstamp', 'updatestamp'], new_column.key_type)!==-1){//date key type special conditions
            errArr.push('datestamp_type');throw new Error("[COLUMNSCHEMA] Key type '"+new_column.key_type+"' must be date. The val type '"+new_column.val_type+"' was provided for column '"+new_column.col_name+"'.");return false;
        }

        var key_type_whitelist=['primary', 'foreign', 'unique', 'index', 'createstamp', 'updatestamp'];
        new_column.key_type=(typeof(new_column.key_type)==='string' && _.indexOf(key_type_whitelist, new_column.key_type)===-1?false:new_column.key_type);
        return new_column;
    };
    columnSchema.prototype.clean=function(valIn, colObj){
        var self=this,
            do_nothing_list=['string'],//should be only ['string'] - you can add to this if you want to put types into development bypass
            number_list=['int','float'],
            output='';

        if(typeof(colObj)==='undefined'){colObj=self;}
        if(!(colObj instanceof columnSchema)){throw new Error("Valid value check: 2nd argument 'column' is invalid (was not a string or valid column object '"+columnSchema.prototype.constructor.name+"'). It could not be found in table '"+tableName+"'.");return false;}
        if((valIn===null || typeof(valIn)==='undefined') && colObj.is_null===true){return null;}
        if(_.indexOf(do_nothing_list, colObj.val_type)!==-1){
            output=valIn;
        }else if(colObj.val_type==='date'){
           var reservered_strs=['NOW()','CURRENT_TIMESTAMP'];
           reservered_strs.forEach(function(v,i,arr){reservered_strs[i]=v.toUpperCase();});
           if(valIn instanceof Date){
               output=valIn;
           }else if(typeof(valIn)==='string' && (_.indexOf(reservered_strs,valIn.toUpperCase())>=0)){
               output=valIn.toUpperCase();
           }else if(typeof(valIn)==='number' || typeof(valIn)==='string'){
               output=new Date(valIn);
           }else{
               throw new Error("[COLUMNSCHEMA] Attempting to clean date type. Input is '"+valIn+"'. Expected 'new Date("+valIn+")' parseable, date reserved-word or object with 'Date constructor'.");return false;
           }
        }else if(colObj.val_type==='enum'){//I hate enums.... will do if necessary
            throw new Error("Enums currently not built");return false;
        }else if(_.indexOf(number_list, colObj.val_type)!==-1){
            output=valIn;
            if(typeof(valIn)!=='number'){
                output=(colObj.val_type==='float'?parseFloat(valIn):parseInt(valIn));
            }
        }else if(colObj.val_type==='boolean'){
            if(typeof(valIn)!=='boolean' && !(typeof(valIn.toString())==='string' && (valIn.toString()==='1' || valIn.toString()==='0'))){
                throw new Error("Could not escape value '"+valIn+"' because it could not be interpreted as '"+colObj.val_type+"'.");return false;}
            output=(valIn.toString()==='1' || valIn?'1':'0');
        }else{
           throw new Error("Could not escape value '"+valIn+"' because it is a type '"+colObj.val_type+"'.");return false;
        }
        if(colObj.val_type==='string' && typeof(output)==='string' && output.length>colObj.size){//string is the only one that needs this. rest of if's should cover their own
            if(!self.silent){console.warn("'"+valIn+"' is longer than allowed string length '"+colObj.size+"' ("+output.length+' > '+colObj.size+")");}
            output=output.substr(0, colObj.size);
        }else if(colObj.val_type==='int'){
            var num_str=output.toString();
            num_str=(num_str.indexOf('.')!==-1?num_str.split('.')[0]:num_str);
            if(!self.silent){
                if(num_str.length>colObj.size){console.warn("'"+valIn+"' is longer than allowed string length '"+colObj.size+"' for column `"+colObj.col_name+"` ("+num_str.length+' > '+colObj.size+").");}
            }
            output=parseInt(num_str.substr(0, colObj.size));
        }else if(colObj.val_type==='float'){
            var num_str=output.toString()
                ex=num_str.split('.'),
                whole_num=(!utils.basic_str(ex[0])?'':ex[0].trim()),
                dec_num=(!utils.basic_str(ex[1])?'':ex[1].trim());
            if(!self.silent){
                if(whole_num.length>colObj.size[0]){console.warn("Whole number portion of '"+valIn+"' is longer than allowed string length '"+colObj.size[0]+"' for column `"+colObj.col_name+"`.");}
                if(dec_num.length>colObj.size[1]){console.warn("Decimal number portion of '"+valIn+"' is longer than allowed string length '"+colObj.size[1]+"' for column `"+colObj.col_name+"`.");}
            }
            whole_num=(!utils.basic_str(whole_num)?'0':whole_num);
            dec_num=(!utils.basic_str(dec_num)?'0':dec_num);
            output=parseFloat(whole_num.substr(0, colObj.size[0])+'.'+dec_num.substr(0, colObj.size[1]));
        }
        return output;
    };
    return columnSchema;
}
