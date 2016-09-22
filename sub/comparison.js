
module.exports = function(){
    //private dependancies
    var GLaDioS=require('GLaDioS')(),utils=require('bom-utils'),merge=require('merge'),_=require('underscore');



    var self_init=function(){//private scope

    };

    //statics
    var whitelist=['AND','!AND','AND NOT','OR','!OR','OR NOT','XOR'],//all including below!
        negs_list=['!AND','AND NOT','!OR','OR NOT'],//just the negatives
        schema={
            'origin': false,// what was passed to create this object when built?
            'comparison_op': false //AND|OR|!AND|AND NOT|!OR|OR NOT|XOR defaults to AND
        };

    function comparision(opts){
        if(!opts){opts={};}
        for(var s in schema){//set schema default
            if(utils.obj_valid_key(schema, s)){this[s]=(typeof(opts[s])!=='undefined'?opts[s]:schema[s]);}}

        opts.hook_ins=(typeof(opts.hook_ins)!=='object'?{}:opts.hook_ins);
        this.hook_ins=new GLaDioS({
            'validate': (typeof(opts.hook_ins.validate)==='function'?opts.hook_ins.validate:false),
            'build': (typeof(opts.hook_ins.build)==='function'?opts.hook_ins.build:false),
            'adhere': (typeof(opts.hook_ins.adhere)==='function'?opts.hook_ins.adhere:false)
        }, this);
        this.hook_ins.change_text('validate', '[COMPARISION] When validating self/schema');
        this.hook_ins.change_text('build','[COMPARISION] When building a logic operator using the schema');
        this.hook_ins.change_text('adhere','[COMPARISION] When adhereing (converting to string segment) a comparision operator');

        //this.xxxxx={'limit':{'row_count':(typeof(opts)!=='undefined' && typeof(opts.xxxxx)==='number'?opts.xxxxx:9000)}};
		self_init.apply(this);//start! self_init that passes the 'this' context through
	};
    comparision.prototype.clean_op=function(compOp){
        var self=this,
            comp_in=(_.indexOf(negs_list, compOp)!==-1 && compOp.indexOf('!')===0?utils.check_strip_first(compOp,'!')+' NOT':compOp);
        if(typeof(comp_in)!=='string' || (typeof(comp_in)==='string' && (!utils.basic_str(comp_in) || _.indexOf(whitelist, comp_in)===-1))){return '';}
        return comp_in;
	};
    comparision.prototype.validate=function(schemaIn){//AND|OR|!AND|AND NOT|!OR|OR NOT|XOR defaults to AND
        var self=this,
            schema_keys=utils.array_keys(schema),
            valid_count=0,
            comp_in=(typeof(schemaIn.comparison_op)==='string'?schemaIn.comparison_op.toUpperCase().trim():false);

        for(var i=0;i<schema_keys.length;i++){
            if(utils.obj_valid_key(schemaIn, schema_keys[i])){
                valid_count++;}}
        if(!valid_count==schema_keys.length){//failed minimum! - must have the same base keys!
            throw new Error('[COMPARISION] \''+schemaIn.constructor.name+'\' schema validate has a key mis-match ('+valid_count+' of '+schema_keys.length+').');return false;}

        //validate based on its values now

        var clean_comp=self.clean_op(comp_in),
            result=self.validate_comparison_op(clean_comp);
        schemaIn.comparison_op=clean_comp;
        self.hook_ins.icallback('validate', {'result':result, 'data_model':schemaIn}, function(newArgs){
            //DO NOTHING WITH newArgs.data_model!!!!
            result=newArgs.result;
        });

        return result;
    };
    comparision.prototype.validate_comparison_op=function(compOp){
        var self=this,
            result=true,
            comp_in=self.clean_op(compOp);
        if(typeof(comp_in)!=='string' || !utils.basic_str(comp_in)){//cleaning leaves nothing but a true value on the whitelist
            throw new Error("[COMPARISION] Invalid comparision operator. Expected values are '"+utils.check_strip_last(whitelist.join(', '), ', ')+"'.");return false;}
        return true;
    };
    comparision.prototype.build=function(compOp){//single arg!
        var self=this,
            args=Array.prototype.slice.call(arguments),//break Pass by Reference
            comp_op=(typeof(compOp)==='undefined'?'AND':self.clean_op(compOp)),
            result=false,
            fail_reason='';

        try{
            result=self.validate_comparison_op(comp_op);}
        catch(e){
            result=false;}
        fail_reason=(!result?'Invalid input \''+compOp+'\'.':'');

        self.hook_ins.icallback('build', {
                'comp_op':comp_op,
                'result':result,
                'fail_reason':fail_reason
            }, function(newArgs){
                comp_op=newArgs.comp_op;
                result=newArgs.result;
                fail_reason=newArgs.fail_reason;
            }
        );
        if(result!==true){throw new Error('[COMPARISION] Build failed - '+(utils.basic_str(fail_reason)?utils.check_strip_last(fail_reason,'.'):'likely due to callback \'build\'')+'.');return false;}

        self.comparison_op=comp_op;
        self.origin=args;

        return true;
    };
    comparision.prototype.adhere=function(schemaIn){
        var self=this,
            data=(typeof(schemaIn)!=='undefined'?schemaIn:self),
            output=data.comparison_op;

        self.hook_ins.icallback('adhere', {'output':output,'data':data}, function(newArgs){output=newArgs.output;});

        return self.comparison_op;
    };

    return comparision;
}
