
module.exports = function(){//dependancies
    var utils=require('bom-utils'),merge=require('merge'),_=require('underscore');

    function genericDBQuery(opts){
        if(!opts){opts={};}
        var typewhitelist=['read','write','execute'],
            query_schema={
                'result':{},//mysql.query(sql_full),
                'type':false,//read/write/execute
                'data':{},
                'sql':''
            };
        for(var s in query_schema){//set query_schema default
            if(utils.obj_valid_key(query_schema, s)){this[s]=typeof(opts[s])!=='undefined'?opts[s]:query_schema[s];}}
        if(_.indexOf(typewhitelist,this.type)===-1){this.type=false;throw new Error("[genericDBQuery] invalid type provided");}
    }
    genericDBQuery.prototype.toString=function(){
        var self=this;
        return "[genericDBQuery] "+self.sql;
    };

    return genericDBQuery;
}
