
module.exports = function(){//dependancies
    var utils=require('bom-utils'),merge=require('merge'),_=require('underscore');

    function genericDBResultStatus(opts){
        if(!opts){opts={};}
        var status_schema={
                'is_success':false,
                'events':false,
                'status': 'fail', //has rows/error! Give the rows/error!
                'info': false
            };
        for(var s in status_schema){//set status_schema default
            if(utils.obj_valid_key(status_schema, s)){this[s]=typeof(opts[s])!=='undefined'?opts[s]:status_schema[s];}}
        this.is_success=(this.status.toLowerCase()!=='fail'?true:this.is_success);
        this.status=(this.is_success===true?'success':'fail');
    }
    genericDBResultStatus.prototype.identify=function(){
        var self=this;
        if(self.events instanceof Array && self.events.length>0){
            var found_types=[],
                found_err=false,
                found_cols=[],
                found_rows=[],
                field_types={
                    '000':'undefined',
                    '8':'number',
                    '254':'string'
                };
            self.events.forEach(function(v,i,arr){
                found_types.push(v.type);
                if(v.type==='fields' || v.type==='result' || v.type==='error'){
                    var pos_res=(v.type==='fields' || v.type==='result'?true:false);
                    v.args.forEach(function(va,ia,arra){
                        if(pos_res && va instanceof Array){
                            va.forEach(function(varg,iarg,arrarg){
                                if(v.type==='result'){
                                    found_cols.push({
                                        'tablename':varg.table,
                                        'name':varg.name,
                                        'type':(utils.obj_valid_key(field_types,varg.type.toString())?field_types[varg.type.toString()]:field_types['000'])
                                    });
                                }
                            });
                        }else if(pos_res && typeof(va)==='object'){
                            var found_data=false;
                            for(var k in va){
                                if(utils.obj_valid_key(va,k)){if(found_data===false){found_data={};}found_data[k]=va[k];}}
                            if(found_data!==false){found_rows.push(found_data);}
                        }else if(typeof(va.code)!=='undefined'){
                            found_err={'msg':va.toString(),'code':va.code,'error_no':va.errno};
                        }
                    });

                }
            });
            if(_.indexOf(found_types,'result')===-1 && _.indexOf(found_types,'fields')!==-1 && _.indexOf(found_types,'end')!==-1){
                return {'status':'norows','cols':found_cols};
            }else if(_.indexOf(found_types,'result')!==-1 && _.indexOf(found_types,'fields')!==-1 && _.indexOf(found_types,'end')!==-1){
                return {'status':'result','cols':found_cols,'rows':found_rows};
            }else if(_.indexOf(found_types,'error')!==-1){
                return {'status':'error','error':found_err};
            }
        }
        return false;
    };
    genericDBResultStatus.prototype.toString=function(){
        var self=this;
        return "[genericDBResultStatus] "+(self.is_success?'TRUE':'FALSE');
    };

    return genericDBResultStatus;
}
